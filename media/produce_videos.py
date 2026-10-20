import asyncio
import os
import subprocess
from pathlib import Path
import edge_tts
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE_DIR = Path(r"C:\Users\gorda\Documents\NexusCRM\media")
ASSETS_DIR = BASE_DIR / "assets"
WORK_DIR = BASE_DIR / "build_tmp"
VIDEOS_DIR = BASE_DIR / "videos"

WORK_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = "es-CO-SalomeNeural"

FONT_BOLD_PATH = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_REG_PATH = r"C:\Windows\Fonts\segoeui.ttf"
FONT_MONO_PATH = r"C:\Windows\Fonts\consolab.ttf"


def get_font(path: str, size: int):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


FONT_TAG = get_font(FONT_MONO_PATH, 18)
FONT_TITLE = get_font(FONT_BOLD_PATH, 42)
FONT_SUBTITLE = get_font(FONT_REG_PATH, 25)
FONT_CAPTION = get_font(FONT_BOLD_PATH, 24)
FONT_AVATAR_NAME = get_font(FONT_BOLD_PATH, 22)
FONT_AVATAR_ROLE = get_font(FONT_REG_PATH, 16)
FONT_BULLET = get_font(FONT_REG_PATH, 23)
FONT_BULLET_BOLD = get_font(FONT_BOLD_PATH, 23)


PROMO_SCENES = [
    {
        "id": "promo_s1",
        "mode": "keynote_full",
        "avatar": "avatar_exec_host_1.jpg",
        "badge": "KEYNOTE OFICIAL · PROJECTSFACTORY.IO × FINANACTIONABLE.CO",
        "title": "NexusPF CRM: El Sistema Operativo AI-Driven para Venta y Renta de Software",
        "bullets": [
            "Diseñado específicamente para fábricas de productos digitales e Inteligencia Artificial.",
            "Unifica en un solo motor la Venta Llave en Mano (CapEx) y la Renta Mensual (MRR / AaaS).",
            "100% Soberano en Docker Desktop con PostgreSQL 16 y listo para Render y Firebase."
        ],
        "caption": "Bienvenidos a NexusPF CRM: donde la ingeniería de projectsfactory.io se une a la inteligencia financiera de finanactionable.co.",
        "narration": (
            "Hola, soy Valeria Mendoza, Directora Ejecutiva de Revenue e Inteligencia Financiera. "
            "En projectsfactory punto io y finanactionable punto co creamos productos digitales y agentes de inteligencia artificial de alto impacto. "
            "Pero los CRMs tradicionales tienen un problema: no entienden la diferencia entre vender un software llave en mano o rentarlo mensualmente como servicio. "
            "Por eso creamos Nexus P F C R M: el primer sistema operativo comercial impulsado por inteligencia artificial para maximizar el valor de nuestro portafolio digital."
        ),
    },
    {
        "id": "promo_s2",
        "mode": "screen_pip",
        "screen": "screen_1_dashboard.png",
        "avatar": "avatar_exec_host_2.jpg",
        "badge": "COMMAND CENTER · VENTA CAPEX VS. RENTA RECURRENTE MRR",
        "title": "Visión Ejecutiva en Tiempo Real y Curva de Equilibrio a 36 Meses",
        "caption": "El Command Center compara en tiempo real el MRR acumulado en Renta frente a la liquidez inmediata de la Venta Directa.",
        "narration": (
            "Desde el Command Center Ejecutivo tienes control absoluto sobre ambas modalidades comerciales. "
            "En tiempo real visualizas el ingreso mensual recurrente de nuestros tenants activos en Render y Firebase, "
            "junto al pipeline de venta de propiedad intelectual llave en mano. "
            "Nuestra curva comparativa a treinta y seis meses revela exactamente en qué mes la renta recurrente supera a la venta directa."
        ),
    },
    {
        "id": "promo_s3",
        "mode": "screen_pip",
        "screen": "screen_2_smartgrid.png",
        "avatar": "avatar_exec_host_2.jpg",
        "badge": "SMART GRID B2B · MAGIC AI COLUMNS (ESTILO ATTIO + CLAY)",
        "title": "Enriquecimiento B2B Autónomo y Ganchos Ejecutivos Generados por IA",
        "caption": "Las Columnas Mágicas IA califican cada cuenta, eligen el activo ideal del catálogo y redactan el mensaje de apertura.",
        "narration": (
            "Inspirado en los mejores sistemas del mundo como Attio y Clay, nuestro Smart Grid incorpora Columnas Mágicas de Inteligencia Artificial. "
            "Con un solo clic, el agente analiza cada empresa cliente, calcula su puntaje de afinidad, "
            "elige qué producto digital de nuestro catálogo ofrecerle y redacta un mensaje ejecutivo personalizado listo para enviar."
        ),
    },
    {
        "id": "promo_s4",
        "mode": "screen_pip",
        "screen": "screen_4_studio.png",
        "avatar": "avatar_exec_host_2.jpg",
        "badge": "FINACTIONABLE DEAL STUDIO · UNIT ECONOMICS EN VIVO",
        "title": "Simulador Interactivo: ¿Vender el Código o Rentar como SaaS / AaaS?",
        "caption": "Simula frente al cliente el Setup Fee, Canon Mensual, Costo Cloud y Precio Buyout con dictamen automático.",
        "narration": (
            "El corazón diferenciador es nuestro FinActionable Deal Studio. "
            "Durante una negociación en vivo puedes ajustar el precio de venta llave en mano, el canon mensual de renta y los costos de nube. "
            "El motor calcula al instante el mes de punto de equilibrio, el valor de vida a veinticuatro y treinta y seis meses y el margen neto, "
            "emitiendo una recomendación financiera respaldada por datos."
        ),
    },
    {
        "id": "promo_s5",
        "mode": "keynote_full",
        "avatar": "avatar_exec_host_1.jpg",
        "badge": "ARQUITECTURA SOBERANA · ZERO-ADMIN & SERVIDOR MCP NATIVO",
        "title": "Cero Licencias por Usuario, Ingesta Zero-Admin y Conexión MCP",
        "bullets": [
            "Zero-Admin AI Bar (Ctrl+K): convierte correos y notas de voz en Cuentas y Oportunidades.",
            "Servidor MCP Nativo: expone 5 herramientas en vivo para agentes como Claude y Antigravity.",
            "Despliegue inmediato local en Docker Desktop y en la nube con Render y Firebase."
        ],
        "caption": "NexusPF CRM: Tu ventaja competitiva soberana para escalar las ventas y rentas de projectsfactory.io y finanactionable.co.",
        "narration": (
            "Además, Nexus P F elimina la carga administrativa con su barra Zero Admin y su servidor M C P nativo, "
            "permitiendo que tus agentes de inteligencia artificial operen el C R M por ti, sin pagar costosas licencias por usuario. "
            "Nexus P F C R M ya está corriendo en tu infraestructura local y listo para escalar globalmente en Render y Firebase."
        ),
    },
]


GUIDE_SCENES = [
    {
        "id": "guide_s1",
        "mode": "keynote_full",
        "avatar": "avatar_exec_host_1.jpg",
        "badge": "GUÍA OFICIAL DE MANEJO · CARACTERÍSTICAS ÚNICAS",
        "title": "Manual Ejecutivo Paso a Paso de NexusPF CRM",
        "bullets": [
            "Aprende a dominar las 6 vistas operativas y financieras en menos de dos minutos.",
            "Descubre las capacidades exclusivas que ningún CRM tradicional del mercado ofrece.",
            "Flujo completo: desde la captura Zero-Admin hasta el dictamen FinActionable y MCP."
        ],
        "caption": "Guía práctica de operación y recorrido por las 6 innovaciones que hacen único a NexusPF CRM.",
        "narration": (
            "Bienvenidos a la guía práctica de manejo de Nexus P F C R M. "
            "En este recorrido paso a paso aprenderás a operar cada módulo de la plataforma "
            "y descubrirás por qué su arquitectura híbrida para venta y renta de activos digitales lo convierte en una herramienta única en su categoría."
        ),
    },
    {
        "id": "guide_s2",
        "mode": "screen_pip",
        "screen": "screen_1_dashboard.png",
        "avatar": "avatar_exec_host_2.jpg",
        "badge": "PASO 1 · COMMAND CENTER & TELEMETRÍA EN TIEMPO REAL",
        "title": "Monitoreo de MRR, Pipeline CapEx, Tenants y Feed Agéntico",
        "caption": "En el panel principal revisa los 4 KPIs maestros, la curva de 36 meses y la tabla de oportunidades prioritarias.",
        "narration": (
            "Paso uno: el Command Center. Al ingresar en el puerto tres mil cuatrocientos, "
            "observas en la fila superior tus cuatro indicadores clave: el ingreso mensual recurrente activo, "
            "el pipeline de venta directa, el número de clientes rentando en nube y las cuentas enriquecidas. "
            "A la derecha tienes el feed de actividad agéntica que registra cada acción automática en PostgreSQL."
        ),
    },
    {
        "id": "guide_s3",
        "mode": "screen_pip",
        "screen": "screen_7_zeroadmin.png",
        "avatar": "avatar_exec_host_2.jpg",
        "badge": "PASO 2 · INGESTA ZERO-ADMIN CON IA (ATAJO CTRL + K)",
        "title": "Creación Automática de Cuentas y Deals desde Texto o Voz",
        "caption": "Presiona Ctrl+K, pega un correo o nota de WhatsApp y deja que el extractor NLP estructure todo el registro.",
        "narration": (
            "Paso dos: Ingesta Zero Admin. Olvídate de llenar formularios interminables. "
            "Presiona Control más K o el botón superior de Ingesta Zero Admin, pega el texto crudo de una reunión, correo o nota de WhatsApp, "
            "y haz clic en Procesar. El motor detecta automáticamente la empresa, el decisor, el producto de interés, "
            "el presupuesto mensual o de compra y crea la cuenta y la oportunidad con su simulación financiera lista."
        ),
    },
    {
        "id": "guide_s4",
        "mode": "screen_pip",
        "screen": "screen_2_smartgrid.png",
        "avatar": "avatar_exec_host_2.jpg",
        "badge": "PASO 3 · SMART GRID B2B Y COLUMNAS MÁGICAS IA",
        "title": "Ejecución de Agentes de Enriquecimiento por Fila o en Lote",
        "caption": "Haz clic en el botón 'Magic AI' de cualquier cuenta o en 'Ejecutar Magic AI en Todas las Filas'.",
        "narration": (
            "Paso tres: Smart Grid y Columnas Mágicas. Al abrir la segunda pestaña del menú lateral, "
            "verás tus cuentas corporativas junto a cuatro columnas con destello azul calculadas por inteligencia artificial. "
            "Puedes pulsar el botón Magic A I en una fila individual o enriquecer toda la base de datos de golpe "
            "para obtener el activo recomendado, la modalidad óptima y el mensaje rompehielo para el decisor."
        ),
    },
    {
        "id": "guide_s5",
        "mode": "screen_pip",
        "screen": "screen_3_kanban.png",
        "avatar": "avatar_exec_host_2.jpg",
        "badge": "PASO 4 · PIPELINE DUAL KANBAN (CAPEX BUYOUT VS. RENTA MRR)",
        "title": "Gestión Visual de Etapas con Comparativa Financiera en cada Tarjeta",
        "caption": "Cada tarjeta muestra simultáneamente el canon mensual MRR, el equivalente Buyout y el mes de equilibrio.",
        "narration": (
            "Paso cuatro: Pipeline Dual Kanban. A diferencia de cualquier otro C R M, cada tarjeta de oportunidad "
            "muestra al mismo tiempo cuánto vale el negocio en renta mensual y cuánto vale en venta llave en mano. "
            "Con un solo clic en el botón Avanzar Etapa mueves el negocio desde descubrimiento hasta cierre ganado, "
            "o abres directamente el simulador con los datos de ese cliente."
        ),
    },
    {
        "id": "guide_s6",
        "mode": "screen_pip",
        "screen": "screen_4_studio.png",
        "avatar": "avatar_exec_host_2.jpg",
        "badge": "PASO 5 · FINACTIONABLE DEAL STUDIO & PERSISTENCIA POSTGRESQL",
        "title": "Simulación Interactiva con Sliders y Guardado Directo en el Deal",
        "caption": "Mueve los 5 deslizadores financieros y pulsa 'Guardar Simulación en el Deal' para actualizar PostgreSQL.",
        "narration": (
            "Paso cinco: FinActionable Deal Studio. Selecciona una oportunidad activa en el selector superior "
            "y desliza los cinco controles: precio de venta llave en mano, cuota de instalación, canon mensual de renta, "
            "costo de nube en Render o Firebase y póliza de soporte. "
            "Al encontrar la estructura ideal, pulsa Guardar Simulación para persistir el dictamen directamente en PostgreSQL."
        ),
    },
    {
        "id": "guide_s7",
        "mode": "screen_pip",
        "screen": "screen_6_mcp.png",
        "avatar": "avatar_exec_host_2.jpg",
        "badge": "PASO 6 · SERVIDOR MCP NATIVO, CATÁLOGO IP Y DESPLIEGUE CLOUD",
        "title": "5 Herramientas MCP en Vivo y Blueprints para Render y Firebase",
        "caption": "Prueba las herramientas MCP desde la consola integrada y despliega en la nube con render.yaml y firebase.json.",
        "narration": (
            "Paso seis: Catálogo de Activos y Servidor M C P Nativo. En las últimas pestañas puedes registrar nuevos productos digitales "
            "y probar en vivo las cinco herramientas del protocolo M C P. "
            "Así, cualquier agente externo puede consultar tu pipeline, simular unit economics o inyectar leads sin intervención humana. "
            "Con Nexus P F C R M, tu equipo tiene el control total de sus ventas y rentas digitales."
        ),
    },
]


def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def wrap_text(text: str, font, max_width: int, draw: ImageDraw.ImageDraw):
    words = text.split()
    lines = []
    current = ""
    for w in words:
        test = f"{current} {w}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def draw_voice_equalizer(draw: ImageDraw.ImageDraw, x: int, y: int, frame_idx: int):
    patterns = [
        [10, 22, 16, 28, 14, 26, 18, 12, 24, 16, 20, 12],
        [18, 12, 26, 14, 28, 16, 24, 20, 12, 26, 14, 22],
        [24, 28, 14, 22, 18, 12, 28, 16, 22, 18, 26, 16],
        [14, 18, 24, 16, 12, 24, 14, 26, 16, 12, 18, 24],
    ]
    bars = patterns[frame_idx % len(patterns)]
    bar_w = 5
    gap = 4
    for i, h in enumerate(bars):
        bx = x + i * (bar_w + gap)
        by1 = y + (28 - h) // 2
        by2 = by1 + h
        color = (16, 185, 129) if i % 2 == 0 else (245, 158, 11)
        draw.rounded_rectangle((bx, by1, bx + bar_w, by2), radius=2, fill=color)


def render_keynote_frames(scene: dict, scene_idx: int, total_scenes: int):
    avatar_src = Image.open(ASSETS_DIR / scene["avatar"]).convert("RGBA")
    avatar_src = avatar_src.resize((1920, 1080), Image.Resampling.LANCZOS)

    # Shift avatar 380px to the right so she stands on the right half, 100% unobstructed by the keynote card
    base_bg = avatar_src.filter(ImageFilter.GaussianBlur(radius=28))
    dark_tint = Image.new("RGBA", (1920, 1080), (6, 9, 15, 190))
    base_bg = Image.alpha_composite(base_bg, dark_tint)
    base_bg.paste(avatar_src, (370, 0))

    out_paths = []
    for f_idx in range(4):
        canvas = base_bg.copy()
        overlay = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Left dark glass card for executive keynote typography (x=52..930, leaving x=930..1920 100% clear for Avatar)
        draw_rounded_rect(
            draw,
            (52, 52, 935, 910),
            radius=28,
            fill=(7, 9, 14, 236),
            outline=(16, 185, 129, 185 if f_idx % 2 == 0 else 110),
            width=2,
        )

        # Brand pills at top
        draw_rounded_rect(draw, (86, 88, 324, 126), radius=8, fill=(16, 185, 129, 38), outline=(16, 185, 129, 180), width=1)
        draw.text((102, 96), "PROJECTSFACTORY.IO", font=FONT_TAG, fill=(16, 185, 129, 255))

        draw_rounded_rect(draw, (340, 88, 569, 126), radius=8, fill=(245, 158, 11, 38), outline=(245, 158, 11, 180), width=1)
        draw.text((356, 96), "FINANACTIONABLE.CO", font=FONT_TAG, fill=(245, 158, 11, 255))

        # Scene badge
        draw.text((86, 150), scene["badge"], font=FONT_TAG, fill=(56, 189, 248, 255))

        # Wrapped Main Title
        title_lines = wrap_text(scene["title"], FONT_TITLE, 810, draw)
        ty = 192
        for line in title_lines:
            draw.text((86, ty), line, font=FONT_TITLE, fill=(248, 250, 252, 255))
            ty += 52

        # Divider line
        ty += 16
        draw.line((86, ty, 895, ty), fill=(30, 41, 59, 255), width=2)
        ty += 24

        # Bullets
        for b_i, bullet in enumerate(scene.get("bullets", [])):
            dot_color = (16, 185, 129, 255) if b_i % 2 == 0 else (245, 158, 11, 255)
            draw.ellipse((90, ty + 8, 106, ty + 24), fill=dot_color)
            b_lines = wrap_text(bullet, FONT_BULLET, 760, draw)
            for bl in b_lines:
                draw.text((122, ty), bl, font=FONT_BULLET, fill=(226, 232, 240, 255))
                ty += 33
            ty += 14

        # Executive Speaker Lower-Third Inside Card
        draw_rounded_rect(
            draw,
            (86, 765, 900, 875),
            radius=18,
            fill=(15, 23, 42, 235),
            outline=(56, 189, 248, 120),
            width=1,
        )
        draw.text((112, 785), "Valeria Mendoza · Avatar Ejecutiva IA", font=FONT_AVATAR_NAME, fill=(248, 250, 252, 255))
        draw.text(
            (112, 818),
            "Chief Revenue & FinActionable AI Officer · Presentación en Español",
            font=FONT_AVATAR_ROLE,
            fill=(148, 163, 184, 255),
        )
        draw.text((625, 785), "VOZ IA ACTIVA", font=FONT_TAG, fill=(16, 185, 129, 255))
        draw_voice_equalizer(draw, 768, 782, f_idx)

        # Bottom Full-Width Subtitle Bar
        draw_rounded_rect(
            draw,
            (52, 940, 1868, 1042),
            radius=18,
            fill=(7, 9, 14, 238),
            outline=(30, 41, 59, 220),
            width=2,
        )
        draw.ellipse((84, 982, 100, 998), fill=(16, 185, 129, 255))
        draw.text((114, 974), scene["caption"], font=FONT_CAPTION, fill=(248, 250, 252, 255))
        draw.text((1690, 976), f"ESCENA {scene_idx}/{total_scenes}", font=FONT_TAG, fill=(16, 185, 129, 255))

        merged = Image.alpha_composite(canvas, overlay).convert("RGB")
        p = WORK_DIR / f"{scene['id']}_f{f_idx}.png"
        merged.save(p, quality=95)
        out_paths.append(p)

    return out_paths


def render_screen_pip_frames(scene: dict, scene_idx: int, total_scenes: int):
    screen_img = Image.open(ASSETS_DIR / scene["screen"]).convert("RGBA")
    screen_img = screen_img.resize((1920, 1080), Image.Resampling.LANCZOS)

    avatar_raw = Image.open(ASSETS_DIR / scene["avatar"]).convert("RGBA")
    aw, ah = avatar_raw.size
    crop_s = min(aw, ah)
    left = (aw - crop_s) // 2
    top = (ah - crop_s) // 2
    avatar_sq = avatar_raw.crop((left, top, left + crop_s, top + crop_s)).resize((270, 270), Image.Resampling.LANCZOS)

    mask = Image.new("L", (270, 270), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, 270, 270), radius=26, fill=255)

    out_paths = []
    for f_idx in range(4):
        canvas = screen_img.copy()
        overlay = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Top-Right Floating Step Banner
        draw_rounded_rect(
            draw,
            (460, 12, 1465, 68),
            radius=14,
            fill=(7, 9, 14, 240),
            outline=(16, 185, 129, 190),
            width=2,
        )
        draw.ellipse((484, 32, 498, 46), fill=(16, 185, 129, 255))
        draw.text((510, 28), scene["badge"], font=FONT_TAG, fill=(16, 185, 129, 255))

        # Bottom-Right Executive Avatar Picture-in-Picture Card
        pip_x1, pip_y1, pip_x2, pip_y2 = 1575, 555, 1885, 925
        border_col = (16, 185, 129, 245) if f_idx % 2 == 0 else (245, 158, 11, 245)
        draw_rounded_rect(
            draw,
            (pip_x1, pip_y1, pip_x2, pip_y2),
            radius=28,
            fill=(10, 14, 22, 242),
            outline=border_col,
            width=3,
        )

        overlay.paste(avatar_sq, (pip_x1 + 20, pip_y1 + 18), mask)

        draw.text((pip_x1 + 22, pip_y1 + 298), "Valeria Mendoza · IA", font=FONT_AVATAR_NAME, fill=(248, 250, 252, 255))
        draw.text((pip_x1 + 22, pip_y1 + 328), "Presentadora Ejecutiva", font=FONT_AVATAR_ROLE, fill=(148, 163, 184, 255))
        draw_voice_equalizer(draw, pip_x1 + 178, pip_y1 + 322, f_idx)

        # Bottom Subtitle & Explanation Bar
        draw_rounded_rect(
            draw,
            (38, 942, 1885, 1052),
            radius=18,
            fill=(7, 9, 14, 242),
            outline=(56, 189, 248, 160),
            width=2,
        )
        draw.text((68, 956), scene["title"], font=FONT_AVATAR_NAME, fill=(16, 185, 129, 255))
        draw.text((68, 994), scene["caption"], font=FONT_SUBTITLE, fill=(248, 250, 252, 255))
        draw.text((1715, 960), f"PASO {scene_idx}/{total_scenes}", font=FONT_TAG, fill=(245, 158, 11, 255))

        merged = Image.alpha_composite(canvas, overlay).convert("RGB")
        p = WORK_DIR / f"{scene['id']}_f{f_idx}.png"
        merged.save(p, quality=95)
        out_paths.append(p)

    return out_paths


async def synthesize_speech(text: str, out_mp3: Path):
    if out_mp3.exists() and out_mp3.stat().st_size > 1000:
        return
    try:
        communicate = edge_tts.Communicate(text, VOICE, rate="+4%", pitch="+0Hz")
        await communicate.save(str(out_mp3))
        if out_mp3.exists() and out_mp3.stat().st_size > 1000:
            return
    except Exception as e:
        print(f"edge_tts notice ({e}), using neural Spanish TTS fallback...")
    from gtts import gTTS
    raw_mp3 = out_mp3.with_suffix(".raw.mp3")
    tts = gTTS(text=text, lang="es", tld="com.co", slow=False)
    tts.save(str(raw_mp3))
    cmd = [
        FFMPEG_EXE,
        "-y",
        "-i",
        str(raw_mp3),
        "-filter:a",
        "atempo=1.10",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "192k",
        str(out_mp3),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if raw_mp3.exists():
        raw_mp3.unlink()


async def build_video(scenes: list, output_mp4: Path):
    segment_files = []
    total = len(scenes)

    for idx, scene in enumerate(scenes, start=1):
        print(f"[{output_mp4.name}] Rendering scene {idx}/{total}: {scene['id']}...")
        mp3_path = WORK_DIR / f"{scene['id']}.mp3"
        await synthesize_speech(scene["narration"], mp3_path)

        if scene["mode"] == "keynote_full":
            render_keynote_frames(scene, idx, total)
        else:
            render_screen_pip_frames(scene, idx, total)

        seg_mp4 = WORK_DIR / f"{scene['id']}_seg.mp4"
        frame_pattern = str(WORK_DIR / f"{scene['id']}_f%d.png")

        cmd = [
            FFMPEG_EXE,
            "-y",
            "-stream_loop",
            "-1",
            "-framerate",
            "5",
            "-i",
            frame_pattern,
            "-i",
            str(mp3_path),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-shortest",
            "-r",
            "24",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(seg_mp4),
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        segment_files.append(seg_mp4)

    concat_list = WORK_DIR / f"{output_mp4.stem}_concat.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        for seg in segment_files:
            f.write(f"file '{seg.as_posix()}'\n")

    cmd_concat = [
        FFMPEG_EXE,
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_list),
        "-c",
        "copy",
        str(output_mp4),
    ]
    subprocess.run(cmd_concat, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"SUCCESS: Created {output_mp4} ({output_mp4.stat().st_size / (1024*1024):.2f} MB)")


async def main():
    promo_out = VIDEOS_DIR / "NexusPF_CRM_Promocion_Ejecutiva.mp4"
    guide_out = VIDEOS_DIR / "NexusPF_CRM_Guia_y_Caracteristicas.mp4"
    await build_video(PROMO_SCENES, promo_out)
    await build_video(GUIDE_SCENES, guide_out)


if __name__ == "__main__":
    asyncio.run(main())
