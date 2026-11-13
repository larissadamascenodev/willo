import AppIntents
import Foundation

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

/// Puts the action in the Shortcuts app under Willo, ready to be picked.
@available(iOS 16.0, *)
struct WilloAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: WilloLogPurchaseIntent(),
      phrases: ["Registrar compra no \(.applicationName)"]
    )
  }
}
