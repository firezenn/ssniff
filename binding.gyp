{
  "targets": [
    {
      "target_name": "ssniff",
      "sources": [ "ssniff.cpp" ], 
      "cflags": [ "-std=c++11", "-stdlib=libc++" ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "libraries": [ "-L<(module_root_dir)/lib", "-ltins", "-lcurl" ],
      "include_dirs" : [ "<!(node -p \"require('node-addon-api').include_dir\")" ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOTMENY_TARGET": "10.7"
          }
        }],
        ["OS=='win'", {
          "defines": [
            "_HAS_EXCEPTIONS=1"
          ],
          "msvs_settings": {
            "VCCLCompilerTool" :{
              "ExceptionHandling": 1
            }
          }
        }]
      ]
    },
    {
      "target_name": "action_after_build",
      "type": "none",
      "dependencies": [ "ssniff" ],
      "copies": [
        {
          "files": [ "<(PRODUCT_DIR)/ssniff.node" ],
          "destination": "<(module_root_dir)/out/Release"
        }
      ]
    }
  ]
}