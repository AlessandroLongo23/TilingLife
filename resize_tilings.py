#!/usr/bin/env python3
import os
from PIL import Image
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

def resize_and_convert_image(image_path, size=(300, 300), convert_to_webp=True, remove_png=True):
    """Resize an image to the specified size and convert to WebP if requested."""
    try:
        file_extension = Path(image_path).suffix.lower()
        is_png = file_extension == '.png'
        
        with Image.open(image_path) as img:
            # Resize the image
            if img.size != size:
                resized_img = img.resize(size, Image.Resampling.LANCZOS)
            else:
                resized_img = img.copy()
            
            if convert_to_webp:
                # Create a new path with .webp extension
                path_obj = Path(image_path)
                new_path = path_obj.with_suffix('.webp')
                
                # Save as WebP with good quality
                resized_img.save(new_path, 'WEBP', quality=80)
                print(f"Resized and converted to WebP: {new_path}")
                
                # Remove PNG files if specified
                if remove_png and is_png:
                    os.remove(image_path)
                    print(f"Removed original PNG: {image_path}")
                    
            else:
                # Save with the original format
                resized_img.save(image_path)
                print(f"Resized: {image_path}")
    except Exception as e:
        print(f"Error processing {image_path}: {e}")

def process_directory(directory, convert_to_webp=True, remove_png=True):
    """Process all image files in the given directory."""
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    image_files = []
    
    for root, _, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)
            file_ext = Path(file).suffix.lower()
            if file_ext in image_extensions:
                image_files.append(file_path)
    
    print(f"Found {len(image_files)} images to process")
    
    # Use ThreadPoolExecutor to process images in parallel
    with ThreadPoolExecutor(max_workers=os.cpu_count()) as executor:
        # Pass parameters to the resize function
        executor.map(
            lambda img_path: resize_and_convert_image(
                img_path, 
                convert_to_webp=convert_to_webp,
                remove_png=remove_png
            ), 
            image_files
        )

def remove_all_png_files(directory):
    """Remove all PNG files in the directory and subdirectories."""
    png_files = []
    
    for root, _, files in os.walk(directory):
        for file in files:
            if file.lower().endswith('.png'):
                png_path = os.path.join(root, file)
                png_files.append(png_path)
    
    print(f"Found {len(png_files)} PNG files to remove")
    
    for png_file in png_files:
        try:
            os.remove(png_file)
            print(f"Removed: {png_file}")
        except Exception as e:
            print(f"Error removing {png_file}: {e}")
    
    print(f"Removed {len(png_files)} PNG files")

if __name__ == "__main__":
    # Get the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Set tilings directory path
    tilings_dir = os.path.join(script_dir, "static", "tilings")
    
    # Check if directory exists
    if not os.path.isdir(tilings_dir):
        print(f"Directory not found: {tilings_dir}")
        sys.exit(1)
    
    print(f"Processing images in: {tilings_dir}")
    
    # Set this to False if you want to resize without converting to WebP
    convert_to_webp = True
    
    # Set this to False if you don't want to remove PNG files during conversion
    remove_png = True
    
    # Process directory - resize, convert to WebP, and remove PNGs during conversion
    process_directory(tilings_dir, convert_to_webp, remove_png)
    
    # Additional step to ensure all PNG files are removed, even if they weren't processed
    remove_all_png_files(tilings_dir)
    
    print("Resizing, conversion, and PNG removal complete!") 