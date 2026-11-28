import AppIntents
import Foundation
import SwiftUI
import UserNotifications

/// The Willo Copilot's iPhone actions.
///
/// "Registrar compra no Willo" (a Wallet "Transação" automation) and "Registrar aviso do banco no
/// Willo" (a "Notificação" automation) send what happened to the Copilot's waiting list on the
/// server. Then, without opening the app, Willo shows a card over whatever is on screen — his words,
/// the amount, who — with the iPhone's own two answers under it: Registrar or Cancelar. Registrar
/// writes it at once and Willo's own notification says so; Cancelar (or letting it go) leaves it in
/// the Copilot, to be answered in the app. A new bill, or a purchase that still needs debit or
/// credit, is not answered on the card: a notification takes it to the app.

// MARK: - The server

enum WilloCopilotAPI {
  static func post(_ fields: [String: Any]) async throws -> [String: Any] {
    let d = UserDefaults.standard
    guard
      let code = d.string(forKey: "willo.copilot.code"),
      let base = d.string(forKey: "willo.copilot.url"),
      let url = URL(string: base + "/functions/v1/copilot")
    else {
      throw WilloCopilotError.notSignedIn
    }
    var body = fields
    body["code"] = code
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 20
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, response) = try await URLSession.shared.data(for: request)
    let reply = ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any]) ?? [:]
    if let http = response as? HTTPURLResponse, http.statusCode >= 300 {
      throw WilloCopilotError.server((reply["error"] as? String) ?? "Não foi possível falar com o Willo agora.")
    }
    return reply
  }
}

/// What the card shows, as the server sends it.
struct WilloCard {
  let id: String
  let title: String
  let line: String
  let name: String
  let amount: String
  let income: Bool
  let inApp: Bool

  init?(_ value: Any?) {
    guard let v = value as? [String: Any], let id = v["id"] as? String else { return nil }
    self.id = id
    title = (v["title"] as? String) ?? "Willo Copilot"
    line = (v["line"] as? String) ?? "Posso anotar?"
    name = (v["name"] as? String) ?? ""
    amount = (v["amount"] as? String) ?? ""
    income = (v["income"] as? Bool) ?? false
    inApp = (v["inApp"] as? Bool) ?? false
  }
}

/// The card's body, under Willo's words: the amount large, then who or what.
struct WilloCardView: View {
  let card: WilloCard

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(card.title)
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.secondary)
      HStack(alignment: .firstTextBaseline, spacing: 10) {
        Text((card.income ? "+ " : "") + card.amount)
          .font(.system(size: 30, weight: .heavy))
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        Text(card.name)
          .font(.body.weight(.medium))
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }
}

/// Willo asks on the card; Registrar writes it, and his own notification says so.
enum WilloCopilotAsk {
  static func ask<I: AppIntent>(_ intent: I, reply: [String: Any]) async {
    WilloCopilotNotice.remindTonight()
    guard let card = WilloCard(reply["pending"]) else { return }
    /* Not answerable on the card: a bill needs its due date; a purchase, debit or credit. */
    if card.inApp {
      WilloCopilotNotice.post(title: card.line, body: [card.amount, card.name].filter { !$0.isEmpty }.joined(separator: " · ") + " · toque para conferir")
      return
    }
    do {
      try await intent.requestConfirmation(
        result: .result(dialog: IntentDialog(stringLiteral: card.line), view: WilloCardView(card: card)),
        confirmationActionName: .log,
        showPrompt: false
      )
    } catch {
      /* Cancelar, or let go: it stays in the Copilot, to be answered in the app. */
      return
    }
    do {
      let done = try await WilloCopilotAPI.post(["action": "confirm", "id": card.id])
      if let title = done["title"] as? String, let message = done["message"] as? String {
        WilloCopilotNotice.post(title: title, body: message)
      } else if (done["openApp"] as? Bool) == true {
        WilloCopilotNotice.post(title: card.line, body: (done["message"] as? String) ?? "Toque para conferir no Willo.")
      }
    } catch {
      WilloCopilotNotice.post(title: "Não consegui anotar agora", body: "Ela continua no Willo Copilot. Toque para conferir.")
    }
  }
}

// MARK: - The actions

/// "Registrar compra no Willo": the action a Wallet "Transação" automation runs after a tap-to-pay.
///
/// The fields are text on purpose: whatever the Shortcuts app hands over for the amount
/// ("R$ 12,34", "12.34") is read by the server.
@available(iOS 16.0, *)
struct WilloLogPurchaseIntent: AppIntent {
  static let title: LocalizedStringResource = "Registrar compra no Willo"
  static let description = IntentDescription("Manda a compra para o Willo Copilot e pergunta se pode anotar.")
  static let openAppWhenRun: Bool = false

  @Parameter(title: "Valor", inputConnectionBehavior: .connectToPreviousIntentResult)
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
    let reply = try await WilloCopilotAPI.post(["amount": amount ?? "", "merchant": merchant ?? "", "card": card ?? ""])
    await WilloCopilotAsk.ask(self, reply: reply)
    return .result()
  }
}

/// "Registrar aviso do banco no Willo": the action a "Notificação" automation runs when the bank's
/// app notifies a purchase, a Pix, a transfer or a new bill. Anything that is not money moving is
/// left alone, without a word.
@available(iOS 16.0, *)
struct WilloLogBankNoticeIntent: AppIntent {
  static let title: LocalizedStringResource = "Registrar aviso do banco no Willo"
  static let description = IntentDescription("Lê o aviso do seu banco e pergunta se pode anotar no Willo.")
  static let openAppWhenRun: Bool = false

  @Parameter(title: "Aviso", inputConnectionBehavior: .connectToPreviousIntentResult)
  var notice: String?

  @Parameter(title: "App do banco")
  var app: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Registrar \(\.$notice) no Willo") {
      \.$app
    }
  }

  func perform() async throws -> some IntentResult {
    let reply = try await WilloCopilotAPI.post(["notice": notice ?? "", "app": app ?? ""])
    /* Not money moving, or the other half of a transfer already shown: nothing to say. */
    if (reply["ignored"] as? Bool) == true || (reply["quiet"] as? Bool) == true { return .result() }
    await WilloCopilotAsk.ask(self, reply: reply)
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
    AppShortcut(
      intent: WilloLogBankNoticeIntent(),
      phrases: ["Registrar aviso do banco no \(.applicationName)"],
      shortTitle: "Aviso do banco",
      systemImageName: "bell.badge.fill"
    )
  }
}

// MARK: - Willo's own notifications

/// Willo's notifications on the iPhone: what was written ("Anotadinho! R$ 15,50 na Padaria…"),
/// or what waits for the app. A tap opens the Copilot. Nothing is shown if notifications are off.
enum WilloCopilotNotice {
  static func post(title: String, body: String) {
    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { settings in
      guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
      let content = UNMutableNotificationContent()
      content.title = title
      content.body = body
      content.sound = .default
      content.threadIdentifier = "willo-copilot"
      content.userInfo = ["url": "/copilot", "body": ["url": "/copilot"]]
      center.add(UNNotificationRequest(identifier: "willo-copilot-\(UUID().uuidString)", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)))
    }
  }

  /// One in the evening, in case something is still waiting (replaced each time, so only one).
  static func remindTonight() {
    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { settings in
      guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
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
