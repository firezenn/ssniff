/*
 * Copyright (c) 2016, Matias Fontanini
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * * Redistributions of source code must retain the above copyright
 *   notice, this list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above
 *   copyright notice, this list of conditions and the following disclaimer
 *   in the documentation and/or other materials provided with the
 *   distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

#include <napi.h>
#include <tins/tins.h>
#include "tins/tcp_ip/stream_follower.h"
#include "tins/sniffer.h"
#include <curl/curl.h>
#include <iostream>
#include <sstream>
#include <string>
#include <stdexcept>
#include <chrono>
#include <thread>
#include <stdio.h>
#include <unistd.h>
#include <shared_mutex>

using std::string;
using std::cout;
using std::cerr;
using std::endl;
using std::exception;
using Tins::Packet;
using Tins::Sniffer;
using Tins::SnifferConfiguration;
using Tins::TCPIP::Stream;
using Tins::TCPIP::StreamFollower;

using namespace Tins;
using namespace std;

const std::string SSNIFF_BLOCK = "----SSNIFFBLOCK----";
const std::string SSNIFF_SPLIT = "----SSNIFF----";

class SSNiff {
    private:
        mutable std::shared_mutex send_mu;
        std::vector<std::string> current_dialogs;
        std::string pcap_filter_str;
        std::string iface_str;
        std::string target;
        
        void send_http(std::string dialogs) {
            CURL *curl;
            curl = curl_easy_init();
            if (curl) {
                curl_easy_setopt(curl, CURLOPT_URL, this->target.c_str());
                curl_easy_setopt(curl, CURLOPT_POSTFIELDS, dialogs.c_str());
                struct curl_slist *hs=NULL;
                hs = curl_slist_append(hs, "Content-Type: text/plain");
                std::string content_length = "Content-Length: " + to_string(dialogs.size());
                hs = curl_slist_append(hs, content_length.c_str());
                curl_easy_setopt(curl, CURLOPT_HTTPHEADER, hs);                
                curl_easy_perform(curl);
                curl_easy_cleanup(curl);
            }
        }

        void send_dialogs() {
            std::unique_lock lock(this->send_mu);
            if (this->current_dialogs.size() == 0) {
                return;
            }
            std::stringstream dialogsStream;
            if (this->current_dialogs.size() == 1) {
                dialogsStream << this->current_dialogs[0];
            }
            else {
                for (auto it = this->current_dialogs.begin(); it != this->current_dialogs.end(); it++) {
                    if (it != this->current_dialogs.begin()) {
                        dialogsStream << SSNIFF_BLOCK;
                    }
                    dialogsStream << *it;
                }
            }
            const std::string dialogsStreamStr = dialogsStream.str();
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            send_http(dialogsStreamStr);
            this->current_dialogs.clear();
        }
        
        void on_server_data(Stream& stream) {
            std::unique_lock lock(this->send_mu);
            try {
                const Stream::payload_type& client_payload = stream.client_payload();
                std::string cpd(client_payload.begin(), client_payload.end());
                const Stream::payload_type& server_payload = stream.server_payload();
                std::string spd(server_payload.begin(), server_payload.end());
                Tins::IPv4Address client_addr_v4 = stream.client_addr_v4();
                Tins::IPv4Address server_addr_v4 = stream.server_addr_v4();
                Tins::TCPIP::Stream::hwaddress_type client_hw_addr = stream.client_hw_addr();
                Tins::TCPIP::Stream::hwaddress_type server_hw_addr = stream.server_hw_addr();

                std::stringstream metadata;
                metadata << SSNIFF_SPLIT << "{" 
                    << "\"client_addr_v4\":\"" << client_addr_v4.to_string() << "\""
                    << ", \"server_addr_v4\":\"" << server_addr_v4.to_string() << "\""
                    << ", \"client_hw_addr\":\"" << client_hw_addr.to_string() << "\""
                    << ", \"server_hw_addr\":\"" << server_hw_addr.to_string() << "\""
                    << "}" << SSNIFF_SPLIT;
                
                std::stringstream new_dialog_payloads_data;
                new_dialog_payloads_data << cpd << SSNIFF_SPLIT << spd;
                std::stringstream new_dialog;
                new_dialog << metadata.str() << new_dialog_payloads_data.str();
                std::string new_dialog_str = new_dialog.str();
                this->current_dialogs.push_back(new_dialog.str());
                stream.ignore_client_data();
                stream.ignore_server_data();
            } catch (exception& ex) {
                cerr << "SSNIFF::NativeError::on_server_data " << ex.what() << endl;
            }
        }

        void on_client_data(Stream& stream) { }

        void on_new_stream(Stream& stream) {
            stream.client_data_callback(std::bind(&SSNiff::on_client_data, this, std::placeholders::_1));
            stream.server_data_callback(std::bind(&SSNiff::on_server_data, this, std::placeholders::_1));
            stream.auto_cleanup_payloads(false);
        }
    public:
        SSNiff(unsigned short tcp_distribution_port, std::string pcap_filter_str, std::string iface_str) :
            pcap_filter_str(pcap_filter_str), iface_str(iface_str) {
                this->target = "http://127.0.0.1:" + to_string(tcp_distribution_port) + "/";
            }
            
        void start() {
            try {
                SnifferConfiguration config;
                config.set_filter(this->pcap_filter_str);
                Sniffer sniffer(this->iface_str, config);        
                StreamFollower follower;
                follower.new_stream_callback(std::bind(&SSNiff::on_new_stream, this, std::placeholders::_1));
                std::thread send_interval([this]() {
                    while (true) {
                        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
                        this->send_dialogs();
                    }
                });
                sniffer.sniff_loop([&](Packet& packet) {
                    follower.process_packet(packet);
                    return true;
                });
                send_interval.join();
            }
            catch (exception& ex) {
                cerr << "SSNIFF::NativeError::start " << ex.what() << endl;
            }
        }
};