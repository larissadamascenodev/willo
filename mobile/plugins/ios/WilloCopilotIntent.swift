import AppIntents
import Foundation
import UserNotifications

/// "Registrar compra no Willo": the action a Wallet "Transação" automation runs after a
/// tap-to-pay. It sends the purchase to the Willo Copilot queue, where the person confirms
/// it in the app — nothing is recorded without them.
///
/// The fields are text on purpose: whatever the Shortcuts app hands over for the amount
/// ("R$ 12,34", "12.34") is read by the server, which also finds the amount inside the
/// whole purchase if that is what arrives.
@available(iOS 16.0, *)
struct WilloLogPurchaseIntent: AppIntent {
  static let title: LocalizedStringResource = "Registrar compra no Willo"
  static let description = IntentDescription("Manda a compra para o Willo Copilot. Você confirma no app.")
  static let openAppWhenRun: Bool = false

  @Parameter(title: "Valor")
  var amount: String?

  @Parameter(title: "Comerciante")
  var merchant: String?

  @Parameter(title: "Cartão")
  var card: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Registrar \(\.$amount) de \(\.$merchant) no Willo") {
      \.$card
    }
  }

  func perform() async throws -> some IntentResult {
    let d = UserDefaults.standard
    guard
      let code = d.string(forKey: "willo.copilot.code"),
      let base = d.string(forKey: "willo.copilot.url"),
      let url = URL(string: base + "/functions/v1/copilot")
    else {
      throw WilloCopilotError.notSignedIn
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 20
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: [
      "code": code,
      "amount": amount ?? "",
      "merchant": merchant ?? "",
      "card": card ?? "",
    ])

    let (data, response) = try await URLSession.shared.data(for: request)
    if let http = response as? HTTPURLResponse, http.statusCode >= 300 {
      let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
      throw WilloCopilotError.server((body?["error"] as? String) ?? "Não foi possível enviar a compra ao Willo.")
    }
    let reply = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    WilloCopilotNotice.arrived((reply?["message"] as? String) ?? "Uma compra chegou no Willo Copilot")
    return .result()
  }
}

@available(iOS 16.0, *)
enum WilloCopilotError: Error, CustomLocalizedStringResourceConvertible {
  case notSignedIn
  case server(String)

  var localizedStringResource: LocalizedStringResource {
    switch self {
    case .notSignedIn:
      return "Abra o Willo e entre na sua conta para usar o Copilot."
    case .server(let message):
      return "\(message)"
    }
  }
}

/// "Registro rápido do Willo": opens the app straight on Registro rápido — for the double
/// tap on the back of the iPhone, Siri, or the Action button. It leaves the screen to open
/// where the app looks for it as it comes to the front (WilloCopilotModule.takeRoute).
@available(iOS 16.0, *)
struct WilloQuickEntryIntent: AppIntent {
  static let title: LocalizedStringResource = "Registro rápido do Willo"
  static let description = IntentDescription("Abre o Willo direto no Registro rápido.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    UserDefaults.standard.set("rapido", forKey: "willo.route")
    return .result()
  }
}

/// Puts the actions in the Shortcuts app under Willo, ready to be picked — no shortcut to
/// build by hand.
@available(iOS 16.0, *)
struct WilloAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: WilloQuickEntryIntent(),
      phrases: ["Registro rápido no \(.applicationName)", "Anotar gasto no \(.applicationName)"],
      shortTitle: "Registro rápido",
      systemImageName: "bolt.fill"
    )
    AppShortcut(
      intent: WilloLogPurchaseIntent(),
      phrases: ["Registrar compra no \(.applicationName)"],
      shortTitle: "Registrar compra",
      systemImageName: "creditcard.fill"
    )
  }
}


/// What the person sees on the phone when a purchase reaches the Copilot: a notice at once
/// ("iFood · R$ 42,90 no Willo Copilot — toque para confirmar"), and one in the evening
/// in case it is still waiting (replaced by each new purchase, so there is only ever one).
/// Tapping either opens the Copilot. Nothing is shown if notifications are off.
enum WilloCopilotNotice {
  static func arrived(_ message: String) {
    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { settings in
      guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }

      let now = UNMutableNotificationContent()
      now.title = "Willo Copilot"
      now.body = message.replacingOccurrences(of: " no Willo Copilot", with: "") + " · toque para confirmar"
      now.sound = .default
      now.threadIdentifier = "willo-copilot"
      now.userInfo = ["url": "/copilot", "body": ["url": "/copilot"]]
      center.add(UNNotificationRequest(identifier: "willo-copilot-\(UUID().uuidString)", content: now, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)))

      let later = UNMutableNotificationContent()
      later.title = "Compras esperando no Copilot"
      later.body = "Confirme para elas entrarem no seu mês."
      later.threadIdentifier = "willo-copilot"
      later.userInfo = ["url": "/copilot", "body": ["url": "/copilot"]]
      var at = DateComponents()
      at.hour = 20
      at.minute = 0
      let tonight = Calendar.current.component(.hour, from: Date()) < 20
      if !tonight, let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date()) {
        let d = Calendar.current.dateComponents([.year, .month, .day], from: tomorrow)
        at.year = d.year
        at.month = d.month
        at.day = d.day
      }
      center.add(UNNotificationRequest(identifier: "willo-copilot-evening", content: later, trigger: UNCalendarNotificationTrigger(dateMatching: at, repeats: false)))
    }
  }
}
