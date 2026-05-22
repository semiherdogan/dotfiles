#!/usr/bin/env swift

import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

let arguments = CommandLine.arguments.dropFirst()
let debug = arguments.contains("--debug")
let appName = arguments.first { !$0.hasPrefix("--") } ?? "Kitty"

let runningApp = NSWorkspace.shared.runningApplications.first {
  $0.localizedName == appName || $0.bundleIdentifier?.localizedCaseInsensitiveContains(appName) == true
}

guard let runningApp else {
  print("not-running")
  exit(0)
}

if debug {
  fputs("App: \(runningApp.localizedName ?? appName) pid=\(runningApp.processIdentifier)\n", stderr)
}

func isFrontVisibleApp(_ runningApp: NSRunningApplication) -> Bool {
  guard let windows = CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID) as? [[String: Any]] else {
    return false
  }

  for window in windows {
    let layer = window[kCGWindowLayer as String] as? Int ?? 0
    guard layer == 0 else { continue }

    let owner = window[kCGWindowOwnerName as String] as? String ?? ""
    guard !owner.hasPrefix("Alfred") else { continue }

    guard let ownerPIDNumber = window[kCGWindowOwnerPID as String] as? NSNumber else {
      continue
    }

    let ownerPID = ownerPIDNumber.int32Value

    guard let ownerApp = NSRunningApplication(processIdentifier: ownerPID) else {
      continue
    }

    if ownerApp.bundleIdentifier?.localizedCaseInsensitiveContains("alfred") == true {
      continue
    }

    guard ownerApp.activationPolicy == .regular else {
      continue
    }

    if debug {
      fputs("Front visible app: \(owner) pid=\(ownerPID)\n", stderr)
    }

    return ownerPID == runningApp.processIdentifier
  }

  return false
}

if runningApp.isActive || isFrontVisibleApp(runningApp) {
  runningApp.hide()
  print("hidden")
} else {
  _ = runningApp.activate()
  print("activated")
}
