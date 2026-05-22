#!/usr/bin/env swift

import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

let arguments = CommandLine.arguments.dropFirst()
let debug = arguments.contains("--debug")
let appName = arguments.first { !$0.hasPrefix("--") } ?? "Kitty"
let trustOptions = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary

guard AXIsProcessTrustedWithOptions(trustOptions) else {
  fputs("Accessibility permission is required for Alfred or Terminal.\n", stderr)
  exit(1)
}

let runningApp = NSWorkspace.shared.runningApplications.first {
  $0.localizedName == appName || $0.bundleIdentifier?.localizedCaseInsensitiveContains(appName) == true
}

guard let runningApp else {
  fputs("No running app found for \(appName).\n", stderr)
  exit(1)
}

if debug {
  fputs("App: \(runningApp.localizedName ?? appName) pid=\(runningApp.processIdentifier)\n", stderr)
}

let app = AXUIElementCreateApplication(runningApp.processIdentifier)

let axFocusedWindow = kAXFocusedWindowAttribute as CFString
let axMainWindow = kAXMainWindowAttribute as CFString
let axPosition = kAXPositionAttribute as CFString
let axSize = kAXSizeAttribute as CFString
let axWindows = kAXWindowsAttribute as CFString

func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> AnyObject? {
  var value: AnyObject?
  return AXUIElementCopyAttributeValue(element, attribute, &value) == .success ? value : nil
}

func copyCGPoint(_ element: AXUIElement, _ attribute: CFString) -> CGPoint? {
  guard let value = copyAttribute(element, attribute) else { return nil }
  var point = CGPoint.zero
  return AXValueGetValue(value as! AXValue, .cgPoint, &point) ? point : nil
}

func copyCGSize(_ element: AXUIElement, _ attribute: CFString) -> CGSize? {
  guard let value = copyAttribute(element, attribute) else { return nil }
  var size = CGSize.zero
  return AXValueGetValue(value as! AXValue, .cgSize, &size) ? size : nil
}

func firstMovableWindow() -> (AXUIElement, CGPoint, CGSize)? {
  let window =
    copyAttribute(app, axFocusedWindow) as! AXUIElement?
    ?? copyAttribute(app, axMainWindow) as! AXUIElement?
    ?? (copyAttribute(app, axWindows) as? [AXUIElement])?.first

  guard let window,
        let position = copyCGPoint(window, axPosition),
        let size = copyCGSize(window, axSize)
  else {
    return nil
  }

  return (window, position, size)
}

var movableWindow: (AXUIElement, CGPoint, CGSize)?
for _ in 0..<20 {
  movableWindow = firstMovableWindow()
  if movableWindow != nil { break }
  Thread.sleep(forTimeInterval: 0.1)
}

guard let (window, position, size) = movableWindow else {
  fputs("Could not read a movable window for \(appName).\n", stderr)
  exit(1)
}

var displayCount: UInt32 = 0
CGGetActiveDisplayList(0, nil, &displayCount)

var displays = [CGDirectDisplayID](repeating: 0, count: Int(displayCount))
CGGetActiveDisplayList(displayCount, &displays, &displayCount)

let windowCenter = CGPoint(x: position.x + size.width / 2, y: position.y + size.height / 2)
let displayBounds =
  displays.map(CGDisplayBounds).first { $0.contains(windowCenter) }
  ?? CGDisplayBounds(CGMainDisplayID())

var centeredPosition = CGPoint(
  x: displayBounds.midX - size.width / 2,
  y: displayBounds.midY - size.height / 2
)

if debug {
  fputs(
    "Window: position=\(Int(position.x)),\(Int(position.y)) size=\(Int(size.width))x\(Int(size.height)) target=\(Int(centeredPosition.x)),\(Int(centeredPosition.y))\n",
    stderr
  )
}

guard let axPositionValue = AXValueCreate(.cgPoint, &centeredPosition) else {
  fputs("Could not create centered position.\n", stderr)
  exit(1)
}

let result = AXUIElementSetAttributeValue(window, axPosition, axPositionValue)

if debug {
  fputs("Move result: \(result.rawValue)\n", stderr)
}

guard result == .success else {
  fputs("Could not move \(appName) window: \(result.rawValue).\n", stderr)
  exit(1)
}
