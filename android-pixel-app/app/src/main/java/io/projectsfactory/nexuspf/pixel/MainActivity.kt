package io.projectsfactory.nexuspf.pixel

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestRuntimePermissionsIfNeeded()

        // Capture shared text if user shared a message from WhatsApp on their Google Pixel into NexusPF
        val sharedText: String? = if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            intent.getStringExtra(Intent.EXTRA_TEXT)
        } else null

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF10B981),
                    secondary = Color(0xFF06B6D4),
                    tertiary = Color(0xFFF59E0B),
                    background = Color(0xFF05080F),
                    surface = Color(0xFF0B111E)
                )
            ) {
                NexusPixelAppScreen(initialSharedText = sharedText)
            }
        }
    }

    private fun requestRuntimePermissionsIfNeeded() {
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            requestPermissionLauncher.launch(missing.toTypedArray())
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun NexusPixelAppScreen(initialSharedText: String? = null) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("nexuspf_pixel_prefs", Context.MODE_PRIVATE) }
    val coroutineScope = rememberCoroutineScope()

    // Connection Mode: "WIFI_LOCAL" vs "RENDER_CLOUD"
    var connectionMode by remember {
        mutableStateOf(prefs.getString("connection_mode", "WIFI_LOCAL") ?: "WIFI_LOCAL")
    }
    var localWifiUrl by remember {
        mutableStateOf(prefs.getString("local_wifi_url", BuildConfig.DEFAULT_LOCAL_WIFI_URL) ?: BuildConfig.DEFAULT_LOCAL_WIFI_URL)
    }
    var renderCloudUrl by remember {
        mutableStateOf(prefs.getString("render_cloud_url", BuildConfig.DEFAULT_RENDER_CLOUD_URL) ?: BuildConfig.DEFAULT_RENDER_CLOUD_URL)
    }

    val activeBaseUrl = if (connectionMode == "RENDER_CLOUD") renderCloudUrl else localWifiUrl

    var showConnectionDialog by remember { mutableStateOf(false) }
    var showNativeLeadSheet by remember { mutableStateOf(!initialSharedText.isNullOrBlank()) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    // Native Quick Lead Form state (Android Pixel Direct Lead)
    var companyName by remember { mutableStateOf("") }
    var contactName by remember { mutableStateOf("") }
    var contactPhone by remember { mutableStateOf("+57 ") }
    var modality by remember { mutableStateOf("RENTA_MRR") }
    var leadNotes by remember { mutableStateOf(initialSharedText ?: "") }
    var isSubmitting by remember { mutableStateOf(false) }

    BackHandler(enabled = webViewRef?.canGoBack() == true) {
        webViewRef?.goBack()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF05080F))
    ) {
        // GOOGLE PIXEL NATIVE TOP STATUS & ENVIRONMENT SWITCHER BAR
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF090E1A))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .background(Color(0xFF10B981), RoundedCornerShape(7.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("NX", color = Color(0xFF03150E), fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = "NexusPF · Google Pixel App",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = if (connectionMode == "WIFI_LOCAL") "📶 Wi-Fi: $localWifiUrl" else "☁️ Render: $renderCloudUrl",
                        color = Color(0xFF38BDF8),
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                // 1-Click Toggle between Local Wi-Fi and Render Cloud
                Box(
                    modifier = Modifier
                        .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(6.dp))
                        .background(Color(0xFF111927), RoundedCornerShape(6.dp))
                        .clickable {
                            connectionMode = if (connectionMode == "WIFI_LOCAL") "RENDER_CLOUD" else "WIFI_LOCAL"
                            prefs.edit().putString("connection_mode", connectionMode).apply()
                            val nextUrl = if (connectionMode == "RENDER_CLOUD") renderCloudUrl else localWifiUrl
                            webViewRef?.loadUrl("$nextUrl/?device=mobile&source=ANDROID_APP")
                        }
                        .padding(horizontal = 8.dp, vertical = 5.dp)
                ) {
                    Text(
                        text = if (connectionMode == "WIFI_LOCAL") "📶 Local ⇄ ☁️ Cloud" else "☁️ Cloud ⇄ 📶 Local",
                        color = Color(0xFF10B981),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                // Configure IP / URL Button
                Box(
                    modifier = Modifier
                        .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(6.dp))
                        .background(Color(0xFF111927), RoundedCornerShape(6.dp))
                        .clickable { showConnectionDialog = true }
                        .padding(horizontal = 7.dp, vertical = 5.dp)
                ) {
                    Text("⚙️ IP", color = Color(0xFF94A3B8), fontSize = 10.sp)
                }

                // Native Quick Lead Capture Button on Google Pixel
                Box(
                    modifier = Modifier
                        .background(Color(0xFF10B981), RoundedCornerShape(6.dp))
                        .clickable { showNativeLeadSheet = true }
                        .padding(horizontal = 9.dp, vertical = 5.dp)
                ) {
                    Text("+ Lead Pixel", color = Color(0xFF03150E), fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // MAIN HYBRID WEBVIEW CONTAINER
        AndroidView(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    settings.allowFileAccess = true
                    settings.cacheMode = WebSettings.LOAD_DEFAULT
                    settings.userAgentString = "${settings.userAgentString} NexusPF-Android-Pixel/2.0"

                    addJavascriptInterface(NexusPixelJsBridge(ctx), "NexusPixelBridge")

                    webChromeClient = object : WebChromeClient() {
                        override fun onPermissionRequest(request: PermissionRequest?) {
                            request?.grant(request.resources)
                        }
                    }

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                            val url = request?.url?.toString() ?: return false
                            if (url.startsWith("whatsapp://") || url.startsWith("https://wa.me/") || url.startsWith("tel:") || url.startsWith("mailto:")) {
                                try {
                                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                } catch (_: Exception) {}
                                return true
                            }
                            return false
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            // Inject Android Pixel environment flag into the CRM web app
                            view?.evaluateJavascript(
                                """
                                window.IS_NEXUS_ANDROID_PIXEL = true;
                                localStorage.setItem('nexuspf_device', 'mobile');
                                if (typeof applyEnvironmentPreferences === 'function') applyEnvironmentPreferences();
                                if (typeof selectMultichannelTab === 'function') selectMultichannelTab('ANDROID_APP');
                                """.trimIndent(),
                                null
                            )
                        }
                    }

                    loadUrl("$activeBaseUrl/?device=mobile&source=ANDROID_APP")
                    webViewRef = this
                }
            }
        )
    }

    // CONNECTION SETTINGS DIALOG (LOCAL WI-FI IP & RENDER URL)
    if (showConnectionDialog) {
        AlertDialog(
            onDismissRequest = { showConnectionDialog = false },
            containerColor = Color(0xFF0B111E),
            title = {
                Text("Configurar Conexión Google Pixel", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Alterna entre tu servidor Docker en Red Local Wi-Fi (ej. la IP local de tu PC) o la URL en la nube de Render:",
                        color = Color(0xFF94A3B8),
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = localWifiUrl,
                        onValueChange = { localWifiUrl = it.trim() },
                        label = { Text("URL Red Local Wi-Fi (Docker :3400)") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = renderCloudUrl,
                        onValueChange = { renderCloudUrl = it.trim() },
                        label = { Text("URL Producción en Render Cloud") },
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        prefs.edit()
                            .putString("local_wifi_url", localWifiUrl)
                            .putString("render_cloud_url", renderCloudUrl)
                            .apply()
                        showConnectionDialog = false
                        val target = if (connectionMode == "RENDER_CLOUD") renderCloudUrl else localWifiUrl
                        webViewRef?.loadUrl("$target/?device=mobile&source=ANDROID_APP")
                    }
                ) {
                    Text("Guardar y Conectar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showConnectionDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    // NATIVE ANDROID PIXEL QUICK LEAD CAPTURE DIALOG (POSTS DIRECTLY TO /api/leads/multichannel)
    if (showNativeLeadSheet) {
        AlertDialog(
            onDismissRequest = { showNativeLeadSheet = false },
            containerColor = Color(0xFF0B111E),
            title = {
                Text("📱 Nuevo Lead desde Google Pixel (ANDROID_APP)", color = Color(0xFF10B981), fontSize = 15.sp, fontWeight = FontWeight.Bold)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = companyName,
                        onValueChange = { companyName = it },
                        label = { Text("Empresa / Cliente B2B *") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = contactName,
                        onValueChange = { contactName = it },
                        label = { Text("Nombre del Contacto Decisor *") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = contactPhone,
                        onValueChange = { contactPhone = it },
                        label = { Text("WhatsApp / Celular Directo *") },
                        singleLine = true
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = modality == "RENTA_MRR",
                            onClick = { modality = "RENTA_MRR" },
                            label = { Text("🟢 Renta MRR") }
                        )
                        FilterChip(
                            selected = modality == "VENTA_CAPEX",
                            onClick = { modality = "VENTA_CAPEX" },
                            label = { Text("🟡 Venta CapEx") }
                        )
                    }
                    OutlinedTextField(
                        value = leadNotes,
                        onValueChange = { leadNotes = it },
                        label = { Text("Nota de Campo / Requerimiento") },
                        maxLines = 3
                    )
                }
            },
            confirmButton = {
                Button(
                    enabled = !isSubmitting,
                    onClick = {
                        isSubmitting = true
                        coroutineScope.launch {
                            val ok = postNativePixelLead(
                                baseUrl = activeBaseUrl,
                                company = companyName,
                                contact = contactName,
                                phone = contactPhone,
                                modality = modality,
                                notes = leadNotes
                            )
                            isSubmitting = false
                            if (ok) {
                                Toast.makeText(context, "🚀 Lead ANDROID_APP creado en PostgreSQL", Toast.LENGTH_LONG).show()
                                companyName = ""
                                contactName = ""
                                leadNotes = ""
                                showNativeLeadSheet = false
                                webViewRef?.reload()
                            } else {
                                Toast.makeText(context, "⚠️ Verifica la IP/URL de conexión en ⚙️ IP", Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                ) {
                    Text(if (isSubmitting) "Enviando..." else "🚀 Crear Lead en CRM")
                }
            },
            dismissButton = {
                TextButton(onClick = { showNativeLeadSheet = false }) {
                    Text("Cerrar")
                }
            }
        )
    }
}

suspend fun postNativePixelLead(
    baseUrl: String,
    company: String,
    contact: String,
    phone: String,
    modality: String,
    notes: String
): Boolean = withContext(Dispatchers.IO) {
    try {
        val cleanBase = baseUrl.trimEnd('/')
        val url = URL("$cleanBase/api/leads/multichannel")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 8000
            readTimeout = 8000
            setRequestProperty("Content-Type", "application/json; charset=UTF-8")
        }

        val payload = JSONObject().apply {
            put("sourceChannel", "ANDROID_APP")
            put("companyName", company.ifBlank { "Prospecto Capturado en Google Pixel" })
            put("contactName", contact.ifBlank { "Decisor Móvil" })
            put("contactPhone", phone.ifBlank { "+57 310 000 0000" })
            put("modality", modality)
            put("leadTemperature", "HOT")
            put("rawNote", "[Google Pixel Android App] $notes")
        }

        OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
            writer.write(payload.toString())
            writer.flush()
        }

        conn.responseCode in 200..299
    } catch (_: Exception) {
        false
    }
}

class NexusPixelJsBridge(private val context: Context) {
    @JavascriptInterface
    fun openWhatsAppDirect(phone: String, message: String) {
        val cleanPhone = phone.replace(Regex("[^0-9]"), "")
        val uri = Uri.parse("https://wa.me/$cleanPhone?text=${Uri.encode(message)}")
        context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @JavascriptInterface
    fun showNativeToast(msg: String) {
        Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
    }
}
