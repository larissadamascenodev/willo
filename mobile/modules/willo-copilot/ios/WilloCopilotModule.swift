import ExpoModulesCore

/// Keeps the signed-in person's Copilot code where the iPhone action
/// "Registrar compra no Willo" (WilloCopilotIntent.swift, in the app target) reads it.
/// The action runs in the app's own process, so the app's standard defaults are shared.
public class WilloCopilotModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WilloCopilot")

    Function("setCode") { (code: String?, url: String?) in
      let d = UserDefaults.standard
      if let code = code, let url = url, !code.isEmpty, !url.isEmpty {
        d.set(code, forKey: "willo.copilot.code")
        d.set(url, forKey: "willo.copilot.url")
      } else {
        d.removeObject(forKey: "willo.copilot.code")
        d.removeObject(forKey: "willo.copilot.url")
      }
    }

    Function("hasCode") { () -> Bool in
      UserDefaults.standard.string(forKey: "willo.copilot.code") != nil
    }

    /// The screen an iPhone action asked the app to open ("rapido"), handed over once.
    Function("takeRoute") { () -> String? in
      let d = UserDefaults.standard
      let route = d.string(forKey: "willo.route")
      d.removeObject(forKey: "willo.route")
      return route
    }
  }
}
