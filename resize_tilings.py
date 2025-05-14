#!/usr/bin/env python3
import os
from PIL import Image
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

def resize_and_convert_image(image_path, size=(300, 300), target_format="webp", remove_png=True):
    """Resize an image to the specified size and convert to target format if needed."""
    try:
        # Get the file extension
        file_extension = Path(image_path).suffix.lower().lstrip('.')
        is_png = file_extension == 'png'
        output_extension = f".{target_format}"
        
        # Create the target path
        path_obj = Path(image_path)
        target_path = path_obj.with_suffix(output_extension)
        
        # Only check if it's the same file (not a different file with same name)
        # and already correct size and format
        if target_path.exists() and target_path.samefile(image_path):
            with Image.open(image_path) as img:
                if img.size == size:
                    print(f"Already correct size and format: {image_path}")
                    return
        
        with Image.open(image_path) as img:
            # Check if conversion or resize is needed
            needs_resize = img.size != size
            needs_format_change = file_extension != target_format
            
            if not (needs_resize or needs_format_change):
                print(f"Already correct size and format: {image_path}")
                return
            
            # Resize if needed
            if needs_resize:
                resized_img = img.resize(size, Image.Resampling.LANCZOS)
            else:
                resized_img = img.copy()
            
            # Convert to target format
            if needs_format_change:
                # Set quality parameter based on format
                quality_param = {}
                if target_format.lower() == "webp":
                    quality_param = {"quality": 80}
                elif target_format.lower() in ["jpg", "jpeg"]:
                    quality_param = {"quality": 90}
                
                # Always save and overwrite if a file already exists
                resized_img.save(target_path, target_format.upper(), **quality_param)
                
                if target_path.exists() and not target_path.samefile(image_path):
                    print(f"Overwrote existing file and {'resized' if needs_resize else 'converted'}: {target_path}")
                else:
                    print(f"Converted to {target_format.upper()} and {'resized' if needs_resize else ''}: {target_path}")
                
                # Remove PNG files if specified
                if remove_png and is_png:
                    os.remove(image_path)
                    print(f"Removed original PNG: {image_path}")
            else:
                # Just save with the original format, overwriting the existing file
                resized_img.save(image_path)
                print(f"Resized: {image_path}")
    except Exception as e:
        print(f"Error processing {image_path}: {e}")

def process_directory(directory, target_size=(300, 300), target_format="webp", remove_png=True):
    """Process all image files in the given directory."""
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    image_files = []
    
    for root, _, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)
            file_ext = Path(file).suffix.lower()
            if file_ext in image_extensions:
                image_files.append(file_path)
    
    print(f"Found {len(image_files)} images to scan")
    
    # Use ThreadPoolExecutor to process images in parallel
    with ThreadPoolExecutor(max_workers=os.cpu_count()) as executor:
        # Pass parameters to the resize function
        executor.map(
            lambda img_path: resize_and_convert_image(
                img_path, 
                size=target_size,
                target_format=target_format,
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
    
    print(f"Found {len(png_files)} additional PNG files to remove")
    
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
    
    # Set target parameters
    target_size = (300, 300)
    target_format = "webp"  # Can be "webp", "jpg", "png", etc.
    
    # Process directory - resize, convert to target format, and remove PNGs during conversion
    process_directory(
        tilings_dir, 
        target_size=(300, 300),
        target_format='webp', 
        remove_png=True
    )
    
    # Additional step to ensure all PNG files are removed, even if they weren't processed
    # if remove_png:
    #     remove_all_png_files(tilings_dir)
    
    print(f"Processing complete! All images are now {target_size[0]}x{target_size[1]} in {target_format.upper()} format") 