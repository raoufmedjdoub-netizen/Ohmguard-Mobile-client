#!/usr/bin/env python3
"""
Generate OhmGuard app icons based on the shield logo design
"""

from PIL import Image, ImageDraw
import math
import os

# Colors from OhmGuard brand
CYAN = (0, 188, 212)  # #00BCD4 - Shield color
DARK_BLUE = (31, 41, 55)  # #1F2937 - Background
WHITE = (255, 255, 255)

def draw_shield(draw, x, y, size, color, thickness=None, fill=None):
    """Draw a shield shape similar to OhmGuard logo"""
    # Shield proportions
    width = size * 0.7
    height = size * 0.85
    
    # Center offset
    cx = x + size / 2
    cy = y + size / 2 - size * 0.05
    
    # Shield points
    top_y = cy - height / 2
    bottom_y = cy + height / 2
    left_x = cx - width / 2
    right_x = cx + width / 2
    curve_y = cy + height * 0.1
    
    # Create shield path points
    points = []
    
    # Top left corner with small curve
    points.append((left_x + width * 0.1, top_y))
    
    # Top edge with wave/signal effect
    wave_height = size * 0.03
    for i in range(5):
        px = left_x + width * 0.1 + (width * 0.8) * (i / 4)
        py = top_y + (wave_height if i % 2 == 1 else 0)
        points.append((px, py))
    
    # Top right corner
    points.append((right_x - width * 0.1, top_y))
    
    # Right side going down
    points.append((right_x, top_y + height * 0.1))
    points.append((right_x, curve_y))
    
    # Bottom point (curved)
    points.append((cx + width * 0.2, bottom_y - height * 0.2))
    points.append((cx, bottom_y))
    points.append((cx - width * 0.2, bottom_y - height * 0.2))
    
    # Left side going up
    points.append((left_x, curve_y))
    points.append((left_x, top_y + height * 0.1))
    
    if fill:
        draw.polygon(points, fill=fill)
    
    if thickness:
        # Draw outline
        for i in range(len(points)):
            start = points[i]
            end = points[(i + 1) % len(points)]
            draw.line([start, end], fill=color, width=thickness)


def draw_shield_smooth(draw, cx, cy, size, color, thickness=None, fill=None):
    """Draw a smoother shield shape"""
    width = size * 0.6
    height = size * 0.75
    
    top = cy - height / 2
    bottom = cy + height / 2
    left = cx - width / 2
    right = cx + width / 2
    
    # Shield outline points - simplified smooth shape
    num_points = 100
    points = []
    
    for i in range(num_points):
        t = i / num_points
        
        if t < 0.15:  # Top left corner
            angle = math.pi + (math.pi / 2) * (t / 0.15)
            corner_r = width * 0.15
            px = left + corner_r + corner_r * math.cos(angle)
            py = top + corner_r + corner_r * math.sin(angle)
        elif t < 0.35:  # Top edge with wave
            progress = (t - 0.15) / 0.2
            px = left + width * 0.15 + (width * 0.7) * progress
            # Add subtle wave
            wave = math.sin(progress * math.pi * 3) * (size * 0.015)
            py = top + wave
        elif t < 0.5:  # Top right corner
            angle = -math.pi / 2 + (math.pi / 2) * ((t - 0.35) / 0.15)
            corner_r = width * 0.15
            px = right - corner_r + corner_r * math.cos(angle)
            py = top + corner_r + corner_r * math.sin(angle)
        elif t < 0.7:  # Right side
            progress = (t - 0.5) / 0.2
            px = right
            py = top + height * 0.15 + (height * 0.45) * progress
        elif t < 0.85:  # Bottom right curve to point
            progress = (t - 0.7) / 0.15
            px = right - (width / 2) * progress
            py = top + height * 0.6 + (height * 0.4) * math.sin(progress * math.pi / 2)
        elif t < 1.0:  # Bottom left curve
            progress = (t - 0.85) / 0.15
            px = cx - (width / 2) * progress
            py = bottom - (height * 0.4) * (1 - math.cos(progress * math.pi / 2))
    
        points.append((px, py))
    
    if fill:
        draw.polygon(points, fill=fill)
    
    if thickness:
        draw.polygon(points, outline=color, width=thickness)


def create_main_icon(size, output_path):
    """Create main app icon (1024x1024)"""
    img = Image.new('RGBA', (size, size), DARK_BLUE)
    draw = ImageDraw.Draw(img)
    
    # Draw filled shield with cyan outline
    cx, cy = size / 2, size / 2
    shield_size = size * 0.75
    
    # Shield dimensions
    width = shield_size * 0.65
    height = shield_size * 0.8
    
    top = cy - height / 2 + size * 0.02
    left = cx - width / 2
    right = cx + width / 2
    bottom = cy + height / 2 + size * 0.02
    
    thickness = int(size * 0.04)
    
    # Draw shield shape using polygon for cleaner look
    # Top section
    top_curve = top + height * 0.08
    mid_y = cy + height * 0.15
    
    # Shield outline points
    shield_points = [
        (left + width * 0.1, top),  # Top left
        (cx, top - size * 0.02),  # Top center (slight peak for wave effect)
        (right - width * 0.1, top),  # Top right
        (right, top_curve),  # Right top curve
        (right, mid_y),  # Right side
        (cx + width * 0.15, bottom - height * 0.15),  # Bottom right curve
        (cx, bottom),  # Bottom point
        (cx - width * 0.15, bottom - height * 0.15),  # Bottom left curve
        (left, mid_y),  # Left side
        (left, top_curve),  # Left top curve
    ]
    
    # Draw outer shield
    draw.polygon(shield_points, outline=CYAN, width=thickness)
    
    # Draw inner shield (smaller) for the double-line effect at top
    inner_offset = size * 0.05
    inner_points = [
        (left + width * 0.1 + inner_offset, top + inner_offset),
        (cx, top - size * 0.02 + inner_offset + size * 0.01),
        (right - width * 0.1 - inner_offset, top + inner_offset),
    ]
    # Just draw the top wave part
    draw.line(inner_points, fill=CYAN, width=int(thickness * 0.6))
    
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")


def create_adaptive_icon(size, output_path):
    """Create Android adaptive icon (1024x1024 with safe zone)"""
    # Adaptive icons need content in center 66% (safe zone)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))  # Transparent background
    draw = ImageDraw.Draw(img)
    
    cx, cy = size / 2, size / 2
    # Keep shield smaller to fit in safe zone
    shield_size = size * 0.55
    
    width = shield_size * 0.65
    height = shield_size * 0.8
    
    top = cy - height / 2
    left = cx - width / 2
    right = cx + width / 2
    bottom = cy + height / 2
    
    thickness = int(size * 0.035)
    top_curve = top + height * 0.08
    mid_y = cy + height * 0.15
    
    shield_points = [
        (left + width * 0.1, top),
        (cx, top - size * 0.015),
        (right - width * 0.1, top),
        (right, top_curve),
        (right, mid_y),
        (cx + width * 0.15, bottom - height * 0.15),
        (cx, bottom),
        (cx - width * 0.15, bottom - height * 0.15),
        (left, mid_y),
        (left, top_curve),
    ]
    
    # Fill with dark background inside shield
    draw.polygon(shield_points, fill=DARK_BLUE, outline=CYAN, width=thickness)
    
    # Inner wave line
    inner_offset = size * 0.04
    inner_points = [
        (left + width * 0.1 + inner_offset, top + inner_offset),
        (cx, top - size * 0.015 + inner_offset + size * 0.008),
        (right - width * 0.1 - inner_offset, top + inner_offset),
    ]
    draw.line(inner_points, fill=CYAN, width=int(thickness * 0.6))
    
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")


def create_notification_icon(size, output_path):
    """Create notification icon (96x96, white monochrome on transparent)"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size / 2, size / 2
    shield_size = size * 0.85
    
    width = shield_size * 0.65
    height = shield_size * 0.8
    
    top = cy - height / 2
    left = cx - width / 2
    right = cx + width / 2
    bottom = cy + height / 2
    
    thickness = int(size * 0.08)
    top_curve = top + height * 0.08
    mid_y = cy + height * 0.15
    
    shield_points = [
        (left + width * 0.1, top),
        (cx, top - size * 0.02),
        (right - width * 0.1, top),
        (right, top_curve),
        (right, mid_y),
        (cx + width * 0.15, bottom - height * 0.15),
        (cx, bottom),
        (cx - width * 0.15, bottom - height * 0.15),
        (left, mid_y),
        (left, top_curve),
    ]
    
    # White outline only (no fill for notification icons)
    draw.polygon(shield_points, outline=WHITE, width=thickness)
    
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")


def create_splash_image(width, height, output_path):
    """Create splash screen image"""
    img = Image.new('RGBA', (width, height), DARK_BLUE)
    draw = ImageDraw.Draw(img)
    
    cx, cy = width / 2, height / 2 - height * 0.05
    shield_size = min(width, height) * 0.35
    
    w = shield_size * 0.65
    h = shield_size * 0.8
    
    top = cy - h / 2
    left = cx - w / 2
    right = cx + w / 2
    bottom = cy + h / 2
    
    thickness = int(shield_size * 0.045)
    top_curve = top + h * 0.08
    mid_y = cy + h * 0.15
    
    shield_points = [
        (left + w * 0.1, top),
        (cx, top - shield_size * 0.02),
        (right - w * 0.1, top),
        (right, top_curve),
        (right, mid_y),
        (cx + w * 0.15, bottom - h * 0.15),
        (cx, bottom),
        (cx - w * 0.15, bottom - h * 0.15),
        (left, mid_y),
        (left, top_curve),
    ]
    
    draw.polygon(shield_points, outline=CYAN, width=thickness)
    
    # Inner wave
    inner_offset = shield_size * 0.05
    inner_points = [
        (left + w * 0.1 + inner_offset, top + inner_offset),
        (cx, top - shield_size * 0.02 + inner_offset + shield_size * 0.01),
        (right - w * 0.1 - inner_offset, top + inner_offset),
    ]
    draw.line(inner_points, fill=CYAN, width=int(thickness * 0.6))
    
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")


def create_favicon(size, output_path):
    """Create favicon (48x48)"""
    img = Image.new('RGBA', (size, size), DARK_BLUE)
    draw = ImageDraw.Draw(img)
    
    cx, cy = size / 2, size / 2
    shield_size = size * 0.85
    
    width = shield_size * 0.65
    height = shield_size * 0.8
    
    top = cy - height / 2
    left = cx - width / 2
    right = cx + width / 2
    bottom = cy + height / 2
    
    thickness = max(2, int(size * 0.06))
    top_curve = top + height * 0.08
    mid_y = cy + height * 0.15
    
    shield_points = [
        (left + width * 0.1, top),
        (cx, top - size * 0.02),
        (right - width * 0.1, top),
        (right, top_curve),
        (right, mid_y),
        (cx + width * 0.15, bottom - height * 0.15),
        (cx, bottom),
        (cx - width * 0.15, bottom - height * 0.15),
        (left, mid_y),
        (left, top_curve),
    ]
    
    draw.polygon(shield_points, outline=CYAN, width=thickness)
    
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")


if __name__ == "__main__":
    assets_dir = "/app/frontend/assets/images"
    
    print("🎨 Generating OhmGuard icons...")
    print()
    
    # Create all icons
    create_main_icon(1024, os.path.join(assets_dir, "icon.png"))
    create_adaptive_icon(1024, os.path.join(assets_dir, "adaptive-icon.png"))
    create_notification_icon(96, os.path.join(assets_dir, "notification-icon.png"))
    create_splash_image(1284, 2778, os.path.join(assets_dir, "splash-image.png"))
    create_favicon(48, os.path.join(assets_dir, "favicon.png"))
    
    print()
    print("✅ All icons generated successfully!")
