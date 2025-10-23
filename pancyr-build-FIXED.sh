#!/usr/bin/env bash
set -euo pipefail
# --- Java toolchain: предпочитаем JDK 21, иначе 17 ---
if [ -d /usr/lib/jvm/java-21-openjdk-amd64 ]; then
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
elif [ -d /usr/lib/jvm/java-21-openjdk ]; then
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
elif [ -d /usr/lib/jvm/java-17-openjdk-amd64 ]; then
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
fi
if [ -n "${JAVA_HOME:-}" ]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

# ================== НАСТРОЙКИ (можно переопределять через env) ==================
REPO_URL="${REPO_URL:-https://github.com/KovalSE777/pancyr-diag-droid.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/home/koval/dev/pancyr-diag-droid-main}"
APK_MODE="${APK_MODE:-debug}"
PLUGIN_NAME="${PLUGIN_NAME:-BluetoothSerial}"
SPP_UUID="${SPP_UUID:-00001101-0000-1000-8000-00805F9B34FB}"
ANDROID_SDK_DIR="${ANDROID_SDK_DIR:-$HOME/Android/Sdk}"
BUILD_OUT_DIR="${BUILD_OUT_DIR:-/home/koval/dev/pancyr-diag-droid-main/apkmaker/Last APK}"
FORCE_RECLONE="${FORCE_RECLONE:-0}"
# ===============================================================================

# ------------------------- УТИЛИТЫ ЛОГИРОВАНИЯ ---------------------------------
log(){ echo -e "\033[1;36m[$(date +%H:%M:%S)]\033[0m $*"; }
warn(){ echo -e "\033[1;33mWARN:\033[0m $*"; }
fail(){ echo -e "\033[1;31mERROR:\033[0m $*"; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "Не найдено: $1"; }

# ------------------------- ПРОВЕРКИ И УСТАНОВКА SDK ----------------------------
ensure_basics(){
  log "Проверка базовых инструментов"
  sudo apt-get update -y
  sudo apt-get install -y git wget unzip
  if ! command -v java >/dev/null 2>&1; then
    log "Устанавливаю OpenJDK 17"
    sudo apt-get install -y openjdk-17-jdk
  fi
  if ! command -v node >/dev/null 2>&1; then
    fail "Node.js не найден. Установите Node 20+ (например, через nvm) и повторите."
  fi
  need npm
}

ensure_android_sdk(){
  export ANDROID_HOME="$ANDROID_SDK_DIR"
  export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

  if ! command -v sdkmanager >/dev/null 2>&1; then
    log "Android SDK не найден. Ставлю commandline-tools в $ANDROID_HOME"
    mkdir -p "$ANDROID_HOME"
    cd "$ANDROID_HOME"
    mkdir -p cmdline-tools
    TOOLS_ZIP="commandlinetools-linux.zip"
    wget -q -O "$TOOLS_ZIP" "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" || \
    wget -q -O "$TOOLS_ZIP" "https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip"
    unzip -q "$TOOLS_ZIP" -d cmdline-tools
    rm -f "$TOOLS_ZIP"
    if [ -d cmdline-tools/cmdline-tools ]; then
      mv cmdline-tools/cmdline-tools cmdline-tools/latest
    else
      mv cmdline-tools cmdline-tools-old
      mkdir -p cmdline-tools/latest
      mv cmdline-tools-old/* cmdline-tools/latest/ || true
      rmdir cmdline-tools-old || true
    fi
  fi
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
  if ! command -v sdkmanager >/dev/null 2>&1; then
    fail "sdkmanager не найден в PATH ($PATH). Проверьте установку Android SDK."
  fi

  log "Установка платформ/билд-тулов (могут занять время)"
  yes | sdkmanager --licenses || true

  sdkmanager \
    "cmdline-tools;latest" \
    "platform-tools" \
    "build-tools;34.0.0" "build-tools;35.0.0" \
    "platforms;android-34" "platforms;android-35" || fail "sdkmanager: установка пакетов не завершилась успешно"

  if [ -d "$ANDROID_HOME/cmdline-tools/latest-2" ]; then
    rm -rf "$ANDROID_HOME/cmdline-tools/latest"
    mv "$ANDROID_HOME/cmdline-tools/latest-2" "$ANDROID_HOME/cmdline-tools/latest"
  fi

  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
}

# ------------------------- КЛОН/ОБНОВЛЕНИЕ ПРОЕКТА (БЕЗ git clean!) -----------
sync_repo(){
  if [ "$FORCE_RECLONE" = "1" ]; then
    log "FORCE_RECLONE=1 — удаляю и заново клонирую"
    rm -rf "$APP_DIR"
  fi
  
  if [ -d "$APP_DIR/.git" ]; then
    log "Обновляю $APP_DIR (ветка $BRANCH)"
    git -C "$APP_DIR" remote set-url origin "$REPO_URL" || true
    git -C "$APP_DIR" fetch --depth=1 --prune --tags origin "$BRANCH"
    git -C "$APP_DIR" checkout -B "$BRANCH" || true
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
    # НЕ используем git clean -fdx - она удаляет apkmaker!
    git -C "$APP_DIR" submodule update --init --recursive || true
  else
    log "Клонирую $REPO_URL → $APP_DIR (ветка $BRANCH)"
    rm -rf "$APP_DIR"
    git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  
  log "✅ Проект обновлён с GitHub"
}

# ------------------------- WEB-СБОРКА ------------------------------------------
build_web(){
  cd "$APP_DIR"
  log "npm ci"
  npm ci
  log "npm run build"
  npm run build
}

# ------------------------- ГЕНЕРАЦИЯ TS-МОСТА ----------------------------------
ensure_ts_bridge(){
  local TS_FILE="src/lib/capacitor-bluetooth.ts"
  if [ ! -f "$TS_FILE" ] || ! grep -q "registerPlugin<" "$TS_FILE"; then
    log "Создаю/обновляю $TS_FILE"
    mkdir -p "$(dirname "$TS_FILE")"
    cat > "$TS_FILE" <<TS
import { registerPlugin } from '@capacitor/core';

export interface ${PLUGIN_NAME}Plugin {
  scan(): Promise<{ devices: {name:string|null; address:string}[] }>;
  connect(opts:{ mac:string; uuid?:string }): Promise<void>;
  write(opts:{ data:string /* base64 */ }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(event:'data', cb:(ev:{ data:string /* base64 */})=>void): Promise<void>;
}
export const ${PLUGIN_NAME} = registerPlugin<${PLUGIN_NAME}Plugin>('${PLUGIN_NAME}');
export const SPP_UUID = '${SPP_UUID}';

export function toBase64(u8: Uint8Array){ let s=''; for(const b of u8) s+=String.fromCharCode(b); return btoa(s); }
export function fromBase64(b64: string){ const s=atob(b64), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i)&0xFF; return u; }
TS
  fi
}

# ------------------------- CAPACITOR ANDROID -----------------------------------
ensure_android_platform(){
  cd "$APP_DIR"
  if [ ! -d "android" ]; then
    log "Добавляю платформу Android (Capacitor)"
    npx cap add android
  fi

  if [ ! -f "android/gradlew" ]; then
    log "Android-платформа есть, но gradle wrapper отсутствует — переинициализирую"
    rm -rf android
    npx cap add android
  fi

  log "npx cap sync android"
  npx cap sync android
}

# ------------------------- КОПИРОВАНИЕ ФАЙЛОВ С GITHUB -------------------------
ensure_bt_plugin(){
  log "Android: КОПИРУЮ MainActivity + BluetoothSerial с GitHub (не генерирую!)"
  cd "$APP_DIR" || fail "Нет каталога проекта: $APP_DIR"
  [ -d android ] || fail "android/ не найден"

  local CFG_JSON="android/app/src/main/assets/capacitor.config.json"
  local APP_ID=""
  if [ -f "$CFG_JSON" ]; then
    APP_ID="$(grep -oP '"appId"\s*:\s*"\K[^"]+' "$CFG_JSON" 2>/dev/null | head -n1)"
  fi
  [ -n "$APP_ID" ] || APP_ID="app.lovable.ba41ab0de47a46879e70cd17cee4dfd3"
  local APP_PKG_DIR="${APP_ID//.//}"

  local MAIN_ACTIVITY_JAVA="android/app/src/main/java/${APP_PKG_DIR}/MainActivity.java"
  local PLUGIN_JAVA="android/app/src/main/java/${APP_PKG_DIR}/bt/BluetoothSerialPlugin.java"
  mkdir -p "android/app/src/main/java/${APP_PKG_DIR}/bt"

  # КОПИРУЕМ готовые файлы с GitHub!
  if [ -f "$APP_DIR/MainActivity.java" ]; then
    log "✅ Копирую MainActivity.java с GitHub"
    cp "$APP_DIR/MainActivity.java" "$MAIN_ACTIVITY_JAVA"
  else
    fail "MainActivity.java не найден в корне проекта!"
  fi

  if [ -f "$APP_DIR/BluetoothSerialPlugin.java" ]; then
    log "✅ Копирую BluetoothSerialPlugin.java с GitHub"
    cp "$APP_DIR/BluetoothSerialPlugin.java" "$PLUGIN_JAVA"
  else
    fail "BluetoothSerialPlugin.java не найден в корне проекта!"
  fi

  # Исправляем package на правильный APP_ID
  sed -i "s|package .*;|package ${APP_ID};|" "$MAIN_ACTIVITY_JAVA"
  sed -i "s|package .*\.bt;|package ${APP_ID}.bt;|" "$PLUGIN_JAVA"
  sed -i "s|import .*\.bt\.BluetoothSerialPlugin;|import ${APP_ID}.bt.BluetoothSerialPlugin;|" "$MAIN_ACTIVITY_JAVA"

  log "✅ Файлы с GitHub скопированы и package исправлен на ${APP_ID}"

  # ✅ Создаем capacitor.plugins.json (Capacitor 7 формат)
  mkdir -p android/app/src/main/assets
  cat > android/app/src/main/assets/capacitor.plugins.json <<JSON
{
  "plugins": [
    { 
      "pkg": "${APP_ID}.bt",
      "classpath": "${APP_ID}.bt.BluetoothSerialPlugin"
    }
  ]
}
JSON

  # Патчим манифест
  local MAN="android/app/src/main/AndroidManifest.xml"
  [ -f "$MAN" ] || fail "Нет $MAN"

  sed -i "s|android:name=\"com.getcapacitor.BridgeActivity\"|android:name=\"${APP_ID}.MainActivity\"|g" "$MAN"

  awk -v fqcn="${APP_ID}.MainActivity" '
    {
      if ($0 ~ "<activity" && $0 ~ fqcn){
        if ($0 !~ /android:exported=/){
          sub(/<activity /,"<activity android:exported=\"true\" ",$0)
        }
      }
      print
    }' "$MAN" > "$MAN.tmp" && mv "$MAN.tmp" "$MAN"

  # ✅ Права BT (исправлено: убран maxSdkVersion для LOCATION)
  grep -q 'android.permission.BLUETOOTH_CONNECT' "$MAN" || \
    sed -i '/<application/i\    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />' "$MAN"
  grep -q 'android.permission.BLUETOOTH_SCAN' "$MAN" || \
    sed -i '/<application/i\    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />' "$MAN"
  grep -q 'android.permission.ACCESS_FINE_LOCATION' "$MAN" || \
    sed -i '/<application/i\    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' "$MAN"

  printf 'sdk.dir=%s\n' "$ANDROID_SDK_DIR" > android/local.properties
  if [ -n "${JAVA_HOME:-}" ]; then
    grep -q '^org.gradle.java.home=' android/gradle.properties || \
      echo "org.gradle.java.home=$JAVA_HOME" >> android/gradle.properties
  fi

  ( cd "$APP_DIR" && npx cap sync android )
  
  if [ -f android/app/src/main/assets/capacitor.plugins.json ]; then
    log "✅ capacitor.plugins.json создан"
  fi
}

# ------------------------- СБОРКА APK ------------------------------------------
build_apk(){
  cd "$APP_DIR"
  log "Повторный cap sync"
  npx cap sync android

  log "Сборка Gradle ($APK_MODE)"
  pushd android >/dev/null
  
  if [ -n "${JAVA_HOME:-}" ]; then
    if grep -q '^org.gradle.java.home=' gradle.properties 2>/dev/null; then
      sed -i "s|^org.gradle.java.home=.*|org.gradle.java.home=$JAVA_HOME|" gradle.properties
    else
      echo "org.gradle.java.home=$JAVA_HOME" >> gradle.properties
    fi
  fi

  [ -f ./gradlew ] || fail "Gradle wrapper не найден"

  chmod +x ./gradlew || true
  if [ "$APK_MODE" = "release" ]; then
    ./gradlew assembleRelease
    APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
    [ -f "$APK_PATH" ] || APK_PATH="app/build/outputs/apk/release/app-release.apk"
  else
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
  fi
  popd >/dev/null

  [ -f "android/$APK_PATH" ] || fail "APK не найден ($APK_PATH)"
  mkdir -p "$BUILD_OUT_DIR"

  TS="$(date +%Y%m%d-%H%M%S)"
  OUT_APK="$BUILD_OUT_DIR/pancyr-diag-droid-$APK_MODE-$TS.apk"
  cp -f "android/$APK_PATH" "$OUT_APK"
  log "✅ APK сохранён: $OUT_APK"

  if [ -d "/mnt/c/Users/Public/Downloads" ]; then
    cp -f "$OUT_APK" "/mnt/c/Users/Public/Downloads/" || true
    log "✅ Также скопировано в C:\\Users\\Public\\Downloads"
  fi
}

# ------------------------- МЕЙН ------------------------------------------------
main(){
  log "=========================================="
  log "ВНИМАНИЕ: Используются файлы с GitHub!"
  log "Не генерирую, а копирую готовые файлы"
  log "=========================================="
  
  ensure_basics
  ensure_android_sdk
  sync_repo
  build_web
  ensure_ts_bridge
  ensure_android_platform
  ensure_bt_plugin
  build_apk
  
  log "=========================================="
  log "✅ ГОТОВО! APK собран из файлов с GitHub"
  log "=========================================="
}

main "$@"

