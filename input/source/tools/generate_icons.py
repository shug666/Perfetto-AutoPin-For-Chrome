#!/usr/bin/env python3
"""
Simple PNG icon generator for Perfetto Auto-Pin Chrome extension.
Creates basic colored square icons without external dependencies.
"""

import struct
import zlib
import os

def create_png(width, height, color):
    """Create a simple PNG image with a solid color."""

    def png_chunk(chunk_type, data):
        """Create a PNG chunk."""
        chunk_len = struct.pack('>I', len(data))
        chunk_crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return chunk_len + chunk_type + data + chunk_crc

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk (image header)
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    ihdr = png_chunk(b'IHDR', ihdr_data)

    # IDAT chunk (image data)
    # Create raw pixel data
    raw_data = b''
    r, g, b, a = color
    for y in range(height):
        raw_data += b'\x00'  # Filter type: None
        for x in range(width):
            # Create a simple gradient/rounded effect
            cx, cy = width // 2, height // 2
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            max_dist = (cx ** 2 + cy ** 2) ** 0.5

            # Corner radius effect
            corner_radius = width * 0.2
            in_corner = False
            corners = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
            for cx_corner, cy_corner in corners:
                corner_cx = cx_corner + (corner_radius if cx_corner == 0 else -corner_radius)
                corner_cy = cy_corner + (corner_radius if cy_corner == 0 else -corner_radius)
                if ((x < corner_radius or x >= width - corner_radius) and
                    (y < corner_radius or y >= height - corner_radius)):
                    dist_to_corner = ((x - corner_cx) ** 2 + (y - corner_cy) ** 2) ** 0.5
                    if dist_to_corner > corner_radius:
                        in_corner = True
                        break

            if in_corner:
                raw_data += bytes([0, 0, 0, 0])  # Transparent
            else:
                # Simple gradient
                factor = 1.0 - (dist / max_dist) * 0.3
                raw_data += bytes([
                    min(255, int(r * factor)),
                    min(255, int(g * factor)),
                    min(255, int(b)),
                    a
                ])

    compressed = zlib.compress(raw_data, 9)
    idat = png_chunk(b'IDAT', compressed)

    # IEND chunk
    iend = png_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend


def create_icon_with_pin(size):
    """Create an icon with a pin design."""
    # RGBA color: Blue (#1a73e8)
    base_color = (26, 115, 232, 255)

    # Create base image
    img_data = bytearray()

    for y in range(size):
        img_data.append(0)  # Filter type: None
        for x in range(size):
            # Normalized coordinates
            nx = x / size
            ny = y / size

            # Rounded rectangle background
            margin = 0.08
            corner_r = 0.2

            # Check if inside rounded rect
            in_rect = True
            if nx < margin or nx > 1 - margin or ny < margin or ny > 1 - margin:
                in_rect = False
            else:
                # Check corners
                corners = [
                    (margin + corner_r, margin + corner_r),
                    (1 - margin - corner_r, margin + corner_r),
                    (margin + corner_r, 1 - margin - corner_r),
                    (1 - margin - corner_r, 1 - margin - corner_r)
                ]
                for cx, cy in corners:
                    in_corner_zone = (
                        (nx < margin + corner_r and ny < margin + corner_r and nx < cx and ny < cy) or
                        (nx > 1 - margin - corner_r and ny < margin + corner_r and nx > cx and ny < cy) or
                        (nx < margin + corner_r and ny > 1 - margin - corner_r and nx < cx and ny > cy) or
                        (nx > 1 - margin - corner_r and ny > 1 - margin - corner_r and nx > cx and ny > cy)
                    )
                    if in_corner_zone:
                        dist = ((nx - cx) ** 2 + (ny - cy) ** 2) ** 0.5
                        if dist > corner_r:
                            in_rect = False
                            break

            if not in_rect:
                img_data.extend([0, 0, 0, 0])  # Transparent
            else:
                # Check if in pin shape (simplified)
                pcx, pcy = 0.5, 0.5

                # Pin head (top rectangle)
                in_pin_head = (0.3 < nx < 0.7) and (0.25 < ny < 0.42)

                # Pin body (center rectangle)
                in_pin_body = (0.4 < nx < 0.6) and (0.42 < ny < 0.65)

                # Pin tip (triangle)
                if 0.45 < nx < 0.55 and 0.65 < ny < 0.8:
                    # Check if inside triangle
                    tip_center = 0.5
                    tip_width_at_y = 0.05 * (0.8 - ny) / 0.15
                    in_pin_tip = abs(nx - tip_center) < tip_width_at_y
                else:
                    in_pin_tip = False

                in_pin = in_pin_head or in_pin_body or in_pin_tip

                if in_pin:
                    # White pin
                    img_data.extend([255, 255, 255, 255])
                else:
                    # Blue background with subtle gradient
                    gradient = 1.0 - (ny - margin) * 0.2
                    r = min(255, int(base_color[0] + 40 * gradient))
                    g = min(255, int(base_color[1] + 20 * gradient))
                    b = min(255, int(base_color[2]))
                    img_data.extend([r, g, b, 255])

    return create_png_from_rgba(size, size, bytes(img_data))


def create_png_from_rgba(width, height, raw_data):
    """Create PNG from raw RGBA data with filter bytes."""
    def png_chunk(chunk_type, data):
        chunk_len = struct.pack('>I', len(data))
        chunk_crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return chunk_len + chunk_type + data + chunk_crc

    signature = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr = png_chunk(b'IHDR', ihdr_data)
    compressed = zlib.compress(raw_data, 9)
    idat = png_chunk(b'IDAT', compressed)
    iend = png_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend


def main():
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(os.path.dirname(script_dir), 'icons')

    # Create icons directory if it doesn't exist
    os.makedirs(icons_dir, exist_ok=True)

    # Generate icons for different sizes
    sizes = [16, 48, 128]

    for size in sizes:
        png_data = create_icon_with_pin(size)
        filename = os.path.join(icons_dir, f'icon{size}.png')
        with open(filename, 'wb') as f:
            f.write(png_data)
        print(f'Created {filename} ({size}x{size})')

    print('\nDone! Icons have been created in the icons/ directory.')


if __name__ == '__main__':
    main()
