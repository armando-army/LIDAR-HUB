#!/usr/bin/env python3
"""Register UMBRAL in a sibling LiDAR Studio installation; sensor stays in Studio."""
import argparse
from pathlib import Path
import sys
import webbrowser

ROOT = Path(__file__).resolve().parents[1]

def mount_project(studio_root):
    studio_root = studio_root.resolve()
    if not (studio_root / 'sensor-engine.mjs').is_file() or not (studio_root / 'local/lidar_bridge.py').is_file():
        raise RuntimeError('Elegí la carpeta de LiDAR Studio que contiene sensor-engine.mjs.')
    projects = studio_root / 'projects'
    projects.mkdir(exist_ok=True)
    target = projects / 'umbral-2.0'
    if target.exists() or target.is_symlink():
        if target.resolve() != ROOT:
            raise RuntimeError('Ya hay otra carpeta umbral-2.0 registrada. No se reemplazó.')
    else:
        target.symlink_to(ROOT, target_is_directory=True)
    return target

def main():
    parser = argparse.ArgumentParser(description='Abrir UMBRAL 2.0 con LiDAR Studio')
    parser.add_argument('--studio', type=Path, default=ROOT.parent / 'LIDAR-STUDIO')
    parser.add_argument('--mount-only', action='store_true')
    args = parser.parse_args()
    try:
        mount_project(args.studio)
    except (RuntimeError, OSError) as error:
        print(str(error), file=sys.stderr)
        print('Ubicá UMBRAL-2.0 y LIDAR-STUDIO una al lado de la otra, o indicá --studio /ruta/LIDAR-STUDIO.', file=sys.stderr)
        return 1
    url = 'http://127.0.0.1:8767/projects/umbral-2.0/'
    print('Proyecto registrado: ' + url)
    if not args.mount_only:
        print('Mantené LiDAR Studio iniciado en el puerto 8767 y habilitá la salida JSON.')
        webbrowser.open(url)
    return 0

if __name__ == '__main__':
    sys.exit(main())
