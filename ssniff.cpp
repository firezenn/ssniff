#include <napi.h>
#include <string>
#include <stdio.h>
#include <stdexcept>
#include "ssniff.h"
#include <unistd.h>
#include <curl/curl.h>

using std::string;
using std::cout;
using std::cerr;
using std::endl;
using std::exception;

Napi::Value Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    try {
        Napi::String pcap_filter = info[0].As<Napi::String>();
        std::string pcap_filter_str = pcap_filter.Utf8Value();
        Napi::String iface = info[1].As<Napi::String>();
        std::string iface_str = iface.Utf8Value();
        Napi::String tcpDistributionPort = info[2].As<Napi::String>();
        std::string tcp_distribution_port_str = tcpDistributionPort.Utf8Value();
        unsigned short tcp_distribution_port = static_cast<unsigned short>(std::strtoul(tcp_distribution_port_str.c_str(), NULL, 0));
        SSNiff ssniff{ tcp_distribution_port, pcap_filter_str, iface_str };    
        ssniff.start();
        curl_global_cleanup();
        return Napi::String::New(env, "OK");
    } catch (exception& ex) {
        cerr << "SSNIFF::NativeError::MainStart " << ex.what() << endl;
        return Napi::String::New(env, "ERROR");
    }     
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    /* In windows, this will init the winsock stuff */
    curl_global_init(CURL_GLOBAL_ALL);
    exports.Set(Napi::String::New(env, "start"), Napi::Function::New(env, Start));
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)