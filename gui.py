import os
import sys
import threading
import time
import urllib.request
import webview
import uvicorn

def start_fastapi():
    # Make sure cwd is set to this file's folder so static/ downloads/ are located correctly
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    from main import app
    # Run uvicorn on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

if __name__ == "__main__":
    # 1. Start FastAPI server in a background daemon thread
    server_thread = threading.Thread(target=start_fastapi, daemon=True)
    server_thread.start()

    # 2. Wait until the FastAPI server is responsive
    retries = 50
    started = False
    for _ in range(retries):
        try:
            urllib.request.urlopen("http://127.0.0.1:8000", timeout=1)
            started = True
            break
        except Exception:
            time.sleep(0.1)

    if not started:
        print("Error: FastAPI server failed to start.")
        sys.exit(1)

    # 3. Create native webview desktop window pointing to our FastAPI app
    # Custom window settings: size 1050x700, clean background
    window = webview.create_window(
        title="Local Downloader",
        url="http://127.0.0.1:8000",
        width=1050,
        height=700,
        resizable=True,
        min_size=(900, 600)
    )

    # 4. Start webview GUI loop
    webview.start(debug=False)

    # 5. Clean exit when window is closed (kills background thread/tasks)
    os._exit(0)
