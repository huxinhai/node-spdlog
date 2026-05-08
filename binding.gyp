{
  "targets": [
    {
      "target_name": "spdog",
      "sources": [
        "src/addon.cpp",
        "src/module_exports.cpp",
        "src/logger.cpp",
        "src/js_args.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src",
        "spdlog/include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_CPP_EXCEPTIONS",
        "SPDLOG_ACTIVE_LEVEL=SPDLOG_LEVEL_TRACE"
      ],
      "cflags_cc": [
        "-std=c++20"
      ],
      "cflags_cc!": [
        "-fno-exceptions"
      ],
      "conditions": [
        [
          "OS==\"mac\"",
          {
            "xcode_settings": {
              "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
              "CLANG_CXX_LIBRARY": "libc++",
              "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
              "MACOSX_DEPLOYMENT_TARGET": "10.15"
            }
          }
        ],
        [
          "OS==\"win\"",
          {
            "defines": [
              "SPDLOG_WCHAR_FILENAMES"
            ],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "AdditionalOptions": [
                  "/std:c++20",
                  "/utf-8"
                ],
                "ExceptionHandling": 1
              }
            }
          }
        ]
      ]
    }
  ]
}
