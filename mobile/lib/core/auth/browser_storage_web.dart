import 'dart:html' as html;

String? readLocalValue(String key) => html.window.localStorage[key];

void writeLocalValue(String key, String value) {
  html.window.localStorage[key] = value;
}

void deleteLocalValue(String key) {
  html.window.localStorage.remove(key);
}

String? readSessionValue(String key) => html.window.sessionStorage[key];

void writeSessionValue(String key, String value) {
  html.window.sessionStorage[key] = value;
}

void deleteSessionValue(String key) {
  html.window.sessionStorage.remove(key);
}
