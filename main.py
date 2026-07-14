from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import sys
import threading
import json
import uuid
import yt_dlp
import traceback
import subprocess
import importlib
import webbrowser

app = FastAPI(title="Local Downloader API")

# Setup directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)

HISTORY_FILE = os.path.join(BASE_DIR, "history.json")
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

# Persistent Config management
def load_config():
    default_dir = os.path.join(os.path.expanduser("~"), "Downloads")
    default_config = {
        "download_dir": default_dir,
        "browser_cookies": "none",
        "browser_proxy": "",
        "default_quality": "best"
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Auto-migrate path if it points to the old project subfolder
                old_path = data.get("download_dir", "")
                if "fb downloader" in old_path and "downloads" in old_path:
                    data["download_dir"] = default_dir
                    # Save migrated config immediately
                    try:
                        with open(CONFIG_FILE, 'w', encoding='utf-8') as sf:
                            json.dump(data, sf, indent=4, ensure_ascii=False)
                    except Exception:
                        pass
                default_config.update(data)
        except Exception:
            pass
    return default_config

def save_config(config_data):
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving config: {e}")

# Load active config
config = load_config()
DOWNLOAD_DIR = config["download_dir"]
BROWSER_COOKIES = config["browser_cookies"]
BROWSER_PROXY = config.get("browser_proxy", "")
DEFAULT_QUALITY = config.get("default_quality", "best")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# In-memory download state tracker
downloads_state = {}
history_lock = threading.Lock()

# Engine update status tracker
update_status = {"status": "idle", "error": ""}

class AnalyzeRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    format_select: str  # 'best', '1080p', '720p', '480p', 'mp3'

class OpenFolderRequest(BaseModel):
    filepath: str = None
    action: str = "select"  # "select" or "open"

class OpenUrlRequest(BaseModel):
    url: str

class ConfigUpdateReq(BaseModel):
    download_dir: str
    browser_cookies: str
    browser_proxy: str
    default_quality: str

def format_size(bytes_num):
    if not bytes_num:
        return "0 B"
    size = float(bytes_num)
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"

def format_speed(speed_bytes):
    if not speed_bytes:
        return "0 KB/s"
    speed = float(speed_bytes)
    for unit in ['B/s', 'KB/s', 'MB/s']:
        if speed < 1024.0:
            return f"{speed:.1f} {unit}"
        speed /= 1024.0
    return f"{speed:.1f} GB/s"

def parse_video_info(info):
    thumbnail = info.get('thumbnail')
    if not thumbnail and info.get('thumbnails'):
        thumbnail = info['thumbnails'][-1].get('url')
        
    duration = info.get('duration')
    duration_str = ""
    if duration:
        mins, secs = divmod(duration, 60)
        hours, mins = divmod(mins, 60)
        if hours > 0:
            duration_str = f"{hours:02d}:{mins:02d}:{secs:02d}"
        else:
            duration_str = f"{mins:02d}:{secs:02d}"
    else:
        duration_str = "Live/Unknown"
            
    return {
        "title": info.get('title', 'Unknown Title'),
        "thumbnail": thumbnail or "https://placehold.co/600x400/1e293b/e2e8f0?text=No+Thumbnail",
        "duration": duration_str,
        "uploader": info.get('uploader') or info.get('channel') or 'Unknown Platform',
        "platform": info.get('extractor_key', 'Generic').lower(),
        "url": info.get('webpage_url') or info.get('original_url', ''),
    }

def save_to_history(item, lock, filepath):
    with lock:
        history = []
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    history = json.load(f)
            except Exception:
                history = []
        
        # Remove any existing entry with the same ID
        history = [x for x in history if x.get('download_id') != item['download_id']]
        history.insert(0, item)
        
        # Keep history file size reasonable (max 1000 items - virtually unlimited and lightweight)
        history = history[:1000]
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Error writing history file: {e}")

def run_download_thread(download_id, url, format_select, download_dir, downloads_state, history_lock, history_file):
    ydl_opts = {
        'outtmpl': os.path.join(download_dir, '%(title)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
    }
    if BROWSER_COOKIES != "none":
        ydl_opts['cookiesfrombrowser'] = (BROWSER_COOKIES,)
    if BROWSER_PROXY.strip():
        ydl_opts['proxy'] = BROWSER_PROXY.strip()
    
    if format_select == 'mp3':
        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        })
    else:
        ydl_opts.update({
            'merge_output_format': 'mp4',
        })
        if format_select == '1080p':
            ydl_opts['format'] = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]'
        elif format_select == '720p':
            ydl_opts['format'] = 'bestvideo[height<=720]+bestaudio/best[height<=720]'
        elif format_select == '480p':
            ydl_opts['format'] = 'bestvideo[height<=480]+bestaudio/best[height<=480]'
        else:
            ydl_opts['format'] = 'bestvideo+bestaudio/best'

    def ydl_hook(d):
        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes', 0)
            percent = (downloaded / total * 100) if total > 0 else 0
            speed = d.get('speed') or 0
            eta = d.get('eta') or 0
            
            speed_str = format_speed(speed)
            eta_str = f"{eta // 60:02d}:{eta % 60:02d}" if eta else "00:00"
            downloaded_str = format_size(downloaded)
            total_str = format_size(total)
            
            downloads_state[download_id].update({
                'status': 'downloading',
                'progress': round(percent, 1),
                'speed': speed_str,
                'eta': eta_str,
                'downloaded_size': downloaded_str,
                'total_size': total_str
            })
        elif d['status'] == 'finished':
            downloads_state[download_id].update({
                'status': 'merging',
                'progress': 99.0,
                'speed': '0 KB/s',
                'eta': '00:00'
            })

    ydl_opts['progress_hooks'] = [ydl_hook]

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filepath = ydl.prepare_filename(info)
            
            # Post-download path adjustments
            if format_select == 'mp3':
                filepath = os.path.splitext(filepath)[0] + '.mp3'
            else:
                base_path = os.path.splitext(filepath)[0]
                if not filepath.endswith('.mp4') and os.path.exists(base_path + '.mp4'):
                    filepath = base_path + '.mp4'
                elif not os.path.exists(filepath):
                    for ext in ['.mp4', '.mkv', '.webm', '.mp3']:
                        if os.path.exists(base_path + ext):
                            filepath = base_path + ext
                            break

            downloads_state[download_id].update({
                'status': 'completed',
                'progress': 100.0,
                'filepath': filepath,
                'filename': os.path.basename(filepath),
                'total_size': format_size(os.path.getsize(filepath)) if os.path.exists(filepath) else "Unknown"
            })
            
            save_to_history(downloads_state[download_id], history_lock, history_file)

    except Exception as e:
        error_msg = str(e)
        print(f"Error in download thread: {error_msg}")
        traceback.print_exc()
        downloads_state[download_id].update({
            'status': 'error',
            'error': error_msg
        })

# Engine update thread runner
def run_update_thread():
    global update_status
    update_status = {"status": "updating", "error": ""}
    try:
        # Run pip install upgrade yt-dlp
        subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"], check=True)
        # Reload yt-dlp in the running process
        importlib.reload(yt_dlp)
        update_status = {"status": "success", "error": ""}
    except Exception as e:
        update_status = {"status": "error", "error": str(e)}

@app.post("/api/update-engine")
def trigger_engine_update(background_tasks: BackgroundTasks):
    global update_status
    if update_status["status"] == "updating":
        return update_status
    background_tasks.add_task(run_update_thread)
    return {"status": "started"}

@app.get("/api/update-status")
def get_engine_update_status():
    return update_status

@app.post("/api/analyze")
def analyze_url(req: AnalyzeRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    
    try:
        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
        }
        if BROWSER_COOKIES != "none":
            ydl_opts['cookiesfrombrowser'] = (BROWSER_COOKIES,)
        if BROWSER_PROXY.strip():
            ydl_opts['proxy'] = BROWSER_PROXY.strip()
            
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            parsed = parse_video_info(info)
            return parsed
    except Exception as e:
        err_msg = str(e).split('\n')[0]
        raise HTTPException(status_code=400, detail=f"Error: {err_msg}")

@app.post("/api/download")
def start_download(req: DownloadRequest):
    url = req.url.strip()
    format_select = req.format_select
    
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
        
    try:
        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
        }
        if BROWSER_COOKIES != "none":
            ydl_opts['cookiesfrombrowser'] = (BROWSER_COOKIES,)
        if BROWSER_PROXY.strip():
            ydl_opts['proxy'] = BROWSER_PROXY.strip()
            
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            parsed = parse_video_info(info)
    except Exception as e:
        err_msg = str(e).split('\n')[0]
        raise HTTPException(status_code=400, detail=f"Error validating link: {err_msg}")

    download_id = str(uuid.uuid4())
    downloads_state[download_id] = {
        'download_id': download_id,
        'url': url,
        'title': parsed['title'],
        'thumbnail': parsed['thumbnail'],
        'duration': parsed['duration'],
        'uploader': parsed['uploader'],
        'platform': parsed['platform'],
        'format_select': format_select,
        'status': 'starting',
        'progress': 0.0,
        'speed': '0 KB/s',
        'eta': '00:00',
        'downloaded_size': '0 B',
        'total_size': '0 B',
        'filepath': '',
        'filename': '',
        'error': ''
    }
    
    t = threading.Thread(
        target=run_download_thread,
        args=(download_id, url, format_select, DOWNLOAD_DIR, downloads_state, history_lock, HISTORY_FILE)
    )
    t.start()
    
    return {"download_id": download_id}

@app.get("/api/downloads")
def get_active_downloads():
    return list(downloads_state.values())

@app.get("/api/history")
def get_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []
    return []

@app.delete("/api/history")
def clear_all_history():
    with history_lock:
        try:
            if os.path.exists(HISTORY_FILE):
                with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
                    json.dump([], f, indent=4)
            return {"status": "success"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to clear history: {str(e)}")

@app.delete("/api/history/{item_id}")
def delete_history_item(item_id: str):
    with history_lock:
        try:
            if os.path.exists(HISTORY_FILE):
                with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                    history = json.load(f)
                
                updated_history = [x for x in history if x.get('id') != item_id]
                
                with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
                    json.dump(updated_history, f, indent=4, ensure_ascii=False)
                    
            return {"status": "success"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete history item: {str(e)}")

@app.post("/api/open-folder")
def open_local_folder(req: OpenFolderRequest = None):
    path = DOWNLOAD_DIR
    action = "select"
    if req:
        if req.filepath:
            path = req.filepath
        if req.action:
            action = req.action
        
    try:
        path = os.path.normpath(os.path.abspath(path))
        if not os.path.exists(path):
            path = DOWNLOAD_DIR
            action = "open"
            
        if os.path.isdir(path):
            os.startfile(path)
        else:
            if action == "open":
                os.startfile(path)
            else:
                subprocess.run(["explorer.exe", "/select,", path])
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open: {str(e)}")

@app.post("/api/open-url")
def open_external_url(req: OpenUrlRequest):
    try:
        # Use python standard library to open URL in default user browser
        webbrowser.open(req.url)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open URL: {str(e)}")

@app.get("/api/config")
def get_config():
    return {
        "download_dir": DOWNLOAD_DIR,
        "browser_cookies": BROWSER_COOKIES,
        "browser_proxy": BROWSER_PROXY,
        "default_quality": DEFAULT_QUALITY
    }

@app.post("/api/config")
def update_config(req: ConfigUpdateReq):
    global DOWNLOAD_DIR, BROWSER_COOKIES, BROWSER_PROXY, DEFAULT_QUALITY
    path = req.download_dir.strip()
    cookies = req.browser_cookies.strip().lower()
    proxy = req.browser_proxy.strip()
    quality = req.default_quality.strip().lower()
    
    if not path:
        raise HTTPException(status_code=400, detail="Path cannot be empty")
    if cookies not in ["none", "chrome", "edge", "firefox", "brave"]:
        raise HTTPException(status_code=400, detail="Invalid browser selection")
    if quality not in ["best", "1080p", "720p", "480p", "mp3"]:
        raise HTTPException(status_code=400, detail="Invalid quality selection")
        
    try:
        os.makedirs(path, exist_ok=True)
        # Test writing
        test_file = os.path.join(path, ".write_test")
        with open(test_file, 'w') as f:
            f.write("test")
        os.remove(test_file)
        
        DOWNLOAD_DIR = path
        BROWSER_COOKIES = cookies
        BROWSER_PROXY = proxy
        DEFAULT_QUALITY = quality
        
        save_config({
            "download_dir": DOWNLOAD_DIR,
            "browser_cookies": BROWSER_COOKIES,
            "browser_proxy": BROWSER_PROXY,
            "default_quality": DEFAULT_QUALITY
        })
        
        return {
            "status": "success", 
            "download_dir": DOWNLOAD_DIR,
            "browser_cookies": BROWSER_COOKIES,
            "browser_proxy": BROWSER_PROXY,
            "default_quality": DEFAULT_QUALITY
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Directory is invalid or unwritable: {str(e)}")

import shutil

@app.get("/api/stats")
def get_stats():
    free_space_str = "STORAGE: Unknown"
    try:
        total, used, free = shutil.disk_usage(DOWNLOAD_DIR)
        drive = os.path.splitdrive(DOWNLOAD_DIR)[0] or "C:"
        free_space_str = f"STORAGE: {format_size(free)} AVAILABLE ON {drive.upper()}"
    except Exception:
        pass
        
    history = []
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except Exception:
            pass
            
    completed_items = [x for x in history if x.get('status') == 'completed']
    total_files = len(completed_items)
    
    total_bytes = 0
    for x in completed_items:
        fp = x.get('filepath')
        if fp and os.path.exists(fp):
            total_bytes += os.path.getsize(fp)
            
    return {
        "storage_text": free_space_str,
        "total_files": f"{total_files} Files",
        "total_size_saved": f"{format_size(total_bytes)} disk storage saved"
    }

# Mount static files and redirect root to /static/index.html
@app.get("/")
def read_root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Antigravity Video Downloader backend is running. static/index.html not found yet."}

# Mount static folder
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
