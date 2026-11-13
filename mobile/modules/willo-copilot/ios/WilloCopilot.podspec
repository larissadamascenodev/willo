Pod::Spec.new do |s|
  s.name           = 'WilloCopilot'
  s.version        = '1.0.0'
  s.summary        = 'Hands the Willo Copilot code to the iPhone action that logs Wallet purchases'
  s.description    = s.summary
  s.author         = 'Willo'
  s.homepage       = 'https://appwillo.com'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
