import subprocess
import sys
import os

print("==================================================")
print("Building Local Downloader Desktop Application...")
print("==================================================")

# Change cwd to script folder
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Command options
# --noconsole hides the cmd window
# --onefile compiles everything into a single .exe
# --add-data includes the static HTML/CSS/JS files inside the executable
cmd = [
    "pyinstaller",
    "--clean",
    "--onefile",
    "--noconsole",
    "--add-data", "static;static",
    "--name", "LocalDownloader",
    "gui.py"
]

try:
    print("Running PyInstaller compiler...")
    subprocess.run(cmd, check=True)
    print("\n==================================================")
    print("SUCCESS! Standalone desktop app created successfully.")
    print("Executable path: dist/LocalDownloader.exe")
    print("==================================================")
except subprocess.CalledProcessError as e:
    print(f"\nPyInstaller failed to build. Exit code: {e.returncode}")
    sys.exit(e.returncode)
except Exception as e:
    print(f"\nAn error occurred: {e}")
    sys.exit(1)
