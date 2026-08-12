"""Pull every frame out of a screen recording, ready for build_stack.py.

ffmpeg is not assumed to be installed. imageio-ffmpeg ships a static binary,
so the one inside the wheel is used and nothing is installed system-wide:

    python3 -m pip download --no-deps --dest ./_ff imageio-ffmpeg
    unzip -o ./_ff/*.whl -d ./_ff
    chmod +x ./_ff/imageio_ffmpeg/binaries/ffmpeg-*

Then:  python3 extract_frames.py <video.mov> <out-dir> [--ffmpeg PATH]
"""
import argparse, glob, os, subprocess, sys


def find_ffmpeg(explicit=None):
    if explicit:
        return explicit
    for pat in ('./_ff/imageio_ffmpeg/binaries/ffmpeg-*', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[0]
    return 'ffmpeg'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('out')
    ap.add_argument('--ffmpeg')
    a = ap.parse_args()
    ff = find_ffmpeg(a.ffmpeg)
    os.makedirs(a.out, exist_ok=True)
    for f in glob.glob(os.path.join(a.out, '*.png')):
        os.remove(f)
    # -vsync 0 keeps every decoded frame: dropping duplicates here would throw
    # away the evidence build_stack.py needs to tell a held frame from a slice.
    cmd = [ff, '-hide_banner', '-loglevel', 'error', '-i', a.video,
           '-vsync', '0', os.path.join(a.out, 'f%05d.png')]
    r = subprocess.run(cmd)
    n = len(glob.glob(os.path.join(a.out, '*.png')))
    print(f'{n} frames -> {a.out}')
    sys.exit(r.returncode)


main()
