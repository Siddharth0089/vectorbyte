# VectorByte

An open-source, high-fidelity Raster-to-Vector (R2V) conversion tool aiming for professional-grade accuracy comparable to commercial tools like Vector Magic and Vectorizer.ai.

![VectorByte Dashboard](https://github.com/user-attachments/assets/placeholder-image) <!-- Add a screenshot here later -->

## 🔥 Features

- **AI Super-Resolution**: Uses Real-ESRGAN to upscale pixelated or low-res images before tracing to capture hidden details.
- **Advanced Color Quantization**: Supports **K-Means** (fast) and **Mean-Shift** (highly accurate spatial grouping) clustering for pristine color segmentation.
- **Dual Tracing Engines**: 
  - **V-Tracer**: For high-quality, full-color, stacked-shape SVG generation.
  - **Potrace**: For mathematically perfect, swooping bezier curves (ideal for black-and-white logos and silhouettes).
- **Pixel Art Bypass**: Automatically detects (or manually forces) 4x Nearest-Neighbor interpolation to preserve 8-bit blocky retro aesthetics.
- **Anime & 2D Art Mode**: Dedicated Real-ESRGAN anime model (`RealESRGAN_x4plus_anime_6B`) to keep 2D artwork and flat-color logos razor-sharp without blurry, painted artifacts.
- **Interactive SVG Editor**: Edit paths, merge layers, pick custom hex colors, delete backgrounds, and manage the resulting vector layers directly in your browser.
- **Batch Processing**: Process up to 20 images simultaneously.
- **Multiple Export Formats**: Export your final vectors to **SVG**, **PDF**, **EPS**, or **DXF** formats for CAD/Illustrator compatibility.

---

## 💻 Installation & Usage (Windows / macOS / Linux)

VectorByte runs entirely inside Docker containers, ensuring it works perfectly across Windows, macOS, and Linux without needing to manually install PyTorch, Python, or Node.js on your machine.

### Prerequisites

1. **Install Docker Desktop**: 
   - Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop).
   - **For Windows Users**: Ensure that **WSL 2** (Windows Subsystem for Linux) is installed and enabled in Docker settings for maximum performance.
2. **Install Git**:
   - Download and install [Git](https://git-scm.com/downloads).
3. **⚠️ Allocate Sufficient Memory (CRUCIAL)**:
   - Open Docker Desktop.
   - Go to **Settings (Gear Icon) > Resources > Advanced**.
   - Increase the **Memory limit** to at least **8 GB** (12 GB or 16 GB is highly recommended if your system has it). The AI upscaling models require significant RAM to process images. *If the build fails or the container crashes during conversion, it means Docker ran out of memory.*
   - Click **Apply & restart**.

### Getting Started

1. **Clone the repository**:
   Open your terminal (or Command Prompt / PowerShell on Windows) and run:
   ```bash
   git clone https://github.com/Siddharth0089/vectorbyte.git
   cd vectorbyte
   ```

2. **Start the application**:
   Use Docker Compose to build and start the backend and frontend:
   ```bash
   docker compose build
   docker compose up -d
   ```
   *Note: The first build will take a few minutes as it downloads the Python environment, the Real-ESRGAN AI weights, and system dependencies like Potrace.*

3. **Open the Web Interface**:
   Once the terminal says the containers are running, open your web browser and navigate to:
   👉 **[http://localhost:3000](http://localhost:3000)**

4. **Stopping the application**:
   When you are done, you can stop the background containers by running:
   ```bash
   docker compose down
   ```

---

## 🛠️ Expert Overrides

In the UI, after uploading an image, look under **Advanced Settings** to manually override the auto-detected analysis:
- **Image Profile**: Choose "Pixel Art (8-bit)" to bypass AI blurring for retro graphics.
- **AI Upscale Model**: Choose "Anime & 2D Art" for sharper vector lines on illustrations.
- **Tracing Engine**: Choose "Potrace" for incredibly smooth B&W curves.
- **Color Clustering**: Choose "Mean-Shift" for preserving thin, faint lines that K-Means might usually erase.

---

## 🏗️ Architecture

- **Backend**: FastAPI (Python), OpenCV, PyTorch (+CPU), Real-ESRGAN, Potrace, V-tracer.
- **Frontend**: React, Vite, TailwindCSS.
- **Infrastructure**: Docker & Docker Compose.

---

## 📜 License

MIT License
