package com.mirasmile.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaActionSound
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.provider.MediaStore
import android.provider.Settings
import android.util.Size
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updatePadding
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.mirasmile.app.databinding.ActivityMainBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {

    private lateinit var ui: ActivityMainBinding
    private lateinit var analysisExecutor: ExecutorService
    private lateinit var detector: FaceDetector
    private var imageCapture: ImageCapture? = null
    private val trigger = SmileTrigger()
    private val sound = MediaActionSound()
    private var capturing = false
    private var savedCount = 0
    private var lastUri: Uri? = null
    private var lastState: SmileTrigger.State? = null
    private var showSavedUntil = 0L

    private val askCamera =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) startCamera() else showPermission(permanentlyDenied = !shouldShowRequestPermissionRationale(Manifest.permission.CAMERA))
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        ui = ActivityMainBinding.inflate(layoutInflater)
        setContentView(ui.root)
        immersive()

        // Garder la consigne et les boutons hors des encoches et barres système.
        val topPad = ui.top.paddingTop
        val bottomPad = ui.bottom.paddingBottom
        ViewCompat.setOnApplyWindowInsetsListener(ui.root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            ui.top.updatePadding(top = topPad + bars.top)
            ui.bottom.updatePadding(bottom = bottomPad + bars.bottom)
            insets
        }

        analysisExecutor = Executors.newSingleThreadExecutor()
        detector = FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                .setMinFaceSize(0.15f)
                .build()
        )
        sound.load(MediaActionSound.SHUTTER_CLICK)

        ui.shutter.setOnClickListener {
            trigger.manualFire(SystemClock.elapsedRealtime())
            takePhoto()
        }
        ui.thumb.setOnClickListener { openLastPhoto() }
        ui.grant.setOnClickListener {
            if (!shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) && ui.grant.tag == "settings") {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
            } else {
                askCamera.launch(Manifest.permission.CAMERA)
            }
        }
        updateCount()

        if (hasCamera()) startCamera() else askCamera.launch(Manifest.permission.CAMERA)
    }

    override fun onResume() {
        super.onResume()
        immersive()
        // Retour des réglages après avoir autorisé l'appareil photo.
        if (ui.permission.visibility == View.VISIBLE && hasCamera()) startCamera()
    }

    override fun onDestroy() {
        super.onDestroy()
        analysisExecutor.shutdown()
        detector.close()
        sound.release()
    }

    private fun hasCamera() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun immersive() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun showPermission(permanentlyDenied: Boolean) {
        ui.permission.visibility = View.VISIBLE
        ui.grant.tag = if (permanentlyDenied) "settings" else null
    }

    private fun startCamera() {
        ui.permission.visibility = View.GONE
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(ui.preview.surfaceProvider)
            }

            val capture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()
            imageCapture = capture

            // Petites images pour l'analyse : rapide, le sourire se voit très bien.
            val analysis = ImageAnalysis.Builder()
                .setResolutionSelector(
                    ResolutionSelector.Builder()
                        .setResolutionStrategy(
                            ResolutionStrategy(Size(640, 480), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER)
                        ).build()
                )
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(analysisExecutor, ::analyze)

            try {
                provider.unbindAll()
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_FRONT_CAMERA, preview, capture, analysis)
            } catch (e: Exception) {
                Toast.makeText(this, "Caméra selfie indisponible : ${e.message}", Toast.LENGTH_LONG).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
    private fun analyze(proxy: ImageProxy) {
        val media = proxy.image
        if (media == null) {
            proxy.close(); return
        }
        val input = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)
        detector.process(input)
            .addOnSuccessListener(ContextCompat.getMainExecutor(this)) { faces ->
                // Le visage le plus grand = la personne devant le téléphone.
                val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                onSmile(face?.smilingProbability)
            }
            .addOnCompleteListener { proxy.close() }
    }

    private fun onSmile(smile: Float?) {
        val now = SystemClock.elapsedRealtime()
        val state = trigger.update(smile, now)
        ui.meter.progress = (trigger.level * 100).toInt()

        if (state == SmileTrigger.State.FIRE) takePhoto()
        if (now < showSavedUntil && state != SmileTrigger.State.FIRE) return
        if (state == lastState) return
        lastState = state
        ui.status.setText(
            when (state) {
                SmileTrigger.State.NO_FACE -> R.string.no_face
                SmileTrigger.State.WAITING -> R.string.smile
                SmileTrigger.State.ALMOST -> R.string.almost
                SmileTrigger.State.FIRE -> R.string.saved
                SmileTrigger.State.REARM -> R.string.rearm
            }
        )
    }

    private fun takePhoto() {
        val capture = imageCapture ?: return
        if (capturing) return
        capturing = true

        sound.play(MediaActionSound.SHUTTER_CLICK)
        ui.root.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
        ui.flash.animate().cancel()
        ui.flash.alpha = 0.9f
        ui.flash.animate().alpha(0f).setDuration(350).start()

        val name = "MiraSmile_" + SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.FRANCE).format(Date())
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name)
            put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
            put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/MiraSmile")
        }
        // Photo enregistrée telle qu'on se voit à l'écran (effet miroir).
        val metadata = ImageCapture.Metadata().apply { isReversedHorizontal = true }
        val options = ImageCapture.OutputFileOptions
            .Builder(contentResolver, MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            .setMetadata(metadata)
            .build()

        capture.takePicture(options, ContextCompat.getMainExecutor(this), object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(result: ImageCapture.OutputFileResults) {
                capturing = false
                savedCount++
                updateCount()
                ui.status.setText(R.string.saved)
                lastState = SmileTrigger.State.FIRE
                showSavedUntil = SystemClock.elapsedRealtime() + 1500
                result.savedUri?.let { showThumb(it) }
            }

            override fun onError(e: ImageCaptureException) {
                capturing = false
                Toast.makeText(this@MainActivity, getString(R.string.save_error) + " : " + e.message, Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun showThumb(uri: Uri) {
        lastUri = uri
        try {
            val bmp = contentResolver.loadThumbnail(uri, Size(256, 256), null)
            ui.thumb.setImageBitmap(bmp)
            ui.thumb.visibility = View.VISIBLE
            ui.thumb.scaleX = 0.6f; ui.thumb.scaleY = 0.6f
            ui.thumb.animate().scaleX(1f).scaleY(1f).setDuration(250).start()
        } catch (_: Exception) {
        }
    }

    private fun openLastPhoto() {
        val uri = lastUri ?: return
        try {
            startActivity(
                Intent(Intent.ACTION_VIEW).setDataAndType(uri, "image/jpeg")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            )
        } catch (_: ActivityNotFoundException) {
        }
    }

    private fun updateCount() {
        ui.count.text = if (savedCount == 0) "" else getString(R.string.count, savedCount)
    }
}
