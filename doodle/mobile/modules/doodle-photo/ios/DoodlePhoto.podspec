Pod::Spec.new do |s|
  s.name = 'DoodlePhoto'
  s.version = '1.0.0'
  s.summary = 'Doodle local photo preparation'
  s.description = 'Downsamples selected camera images locally before upload.'
  s.license = { :type => 'Proprietary' }
  s.author = 'SamiStudio'
  s.homepage = 'https://doodle.samistudio.nl'
  s.source = { :path => '.' }
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ImageIO', 'CoreGraphics', 'UniformTypeIdentifiers'
  s.source_files = '*.swift'
end
