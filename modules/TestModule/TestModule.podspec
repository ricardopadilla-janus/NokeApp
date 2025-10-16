require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "TestModule"
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = "https://github.com/yourusername/NokeApp"
  s.license      = package['license']
  s.authors      = package['author']
  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => "https://github.com/yourusername/NokeApp.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}"
  
  # Use install_modules_dependencies helper
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"

    # New Architecture support
    if ENV['RCT_NEW_ARCH_ENABLED'] == '1' then
      s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
      s.pod_target_xcconfig    = {
          "HEADER_SEARCH_PATHS" => "\"$(PODS_ROOT)/boost\"",
          "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
      }
      s.dependency "React-Codegen"
      s.dependency "RCT-Folly"
      s.dependency "RCTRequired"
      s.dependency "RCTTypeSafety"
      s.dependency "ReactCommon/turbomodule/core"
    end
  end
end

