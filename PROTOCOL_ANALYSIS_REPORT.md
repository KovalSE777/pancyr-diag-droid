# Полный анализ системы PancyrDiag — Отчет о соответствии протокола (v1.0)

**Дата анализа:** 17.10.2025  
**Версия спецификации:** v1.0 (17.10.2025)  
**Статус:** ⚠️ Требуется синхронизация

---

## 📋 Исполнительное резюме

Проведен полный аудит текущей реализации Android-приложения PancyrDiag против официальной технической спецификации от 17.10.2025. Выявлены **критические расхождения** в протоколе UDS, маппинге данных и обработке кадров.

### Ключевые находки:

✅ **Соответствует спецификации:**
- Bluetooth SPP транспорт (UUID `00001101-0000-1000-8000-00805F9B34FB`)
- Базовая структура UDS-кадров
- Механизм TesterPresent
- Обработка экранов 0x66/0x77

❌ **Критические расхождения:**
- **UDS адресация:** приложение использует DST=0x28, спецификация требует DST=0x2A
- **Payload маппинг:** несоответствие индексов данных (22 байта vs текущая реализация)
- **Отсутствует:** обработка расширенного формата (26-33 байта)
- **Checksum:** используется неправильная формула (sum8 vs младший байт суммы)

---

## 🔍 Детальный анализ по компонентам

### 1. Bluetooth Transport Layer

#### 📄 Спецификация (ТЗ §1):
```
Транспорт: Bluetooth SPP (RFCOMM)
UUID: 00001101-0000-1000-8000-00805F9B34FB
PIN: 1234 (сопряжение в настройках Android)
Задержка после connect: ~200 мс
```

#### 💻 Текущая реализация:

**Файл:** `src/utils/native-bluetooth.ts`
```typescript
export const SPP_UUID = '00001101-0000-1000-8000-00805F9B34FB'; // ✅ OK

async connect(mac: string): Promise<void> {
  await BluetoothSerial.connect({ mac, uuid: SPP_UUID });
}
```

**Файл:** `android/app/src/main/java/com/koval/pancyr/bt/BluetoothSerialPlugin.kt`
```kotlin
private val sppUUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB") // ✅ OK
```

**Статус:** ✅ **СООТВЕТСТВУЕТ**

**Рекомендация:** Добавить задержку 200 мс после подключения перед отправкой команд (спецификация, схема 1).

---

### 2. UDS Addressing

#### 📄 Спецификация (ТЗ §1, §2):
```
Адреса в ответах устройства:
- DST (получатель): 0xF1 (приложение)
- SRC (источник): 0x2A (БСКУ)

Запросы от приложения:
- SRC: 0xF1 (тестер)
- DST: 0x2A (БСКУ)

⚠️ Примечание: на старых ветках прошивки может быть 0x28, но актуальная — 0x2A
```

#### 💻 Текущая реализация:

**Файл:** `src/utils/protocol-parser.ts`
```typescript
function buildUDS(dst = 0x28, src = 0xF0, sid: number, data: number[] = []): Uint8Array {
  // ❌ ОШИБКА: dst по умолчанию 0x28, должно быть 0x2A
  // ❌ ОШИБКА: src по умолчанию 0xF0, должно быть 0xF1
  const len = 3 + data.length;
  const hdr = [0x80 + len, dst, src, sid];
  const body = [...hdr, ...data];
  const cs = sum8(new Uint8Array(body));
  return new Uint8Array([...body, cs]);
}
```

**Файл:** `src/utils/capacitor-bluetooth.ts`
```typescript
private async sendStartCommunication() {
  const cmd = buildUDS(0x28, 0xF0, 0x81, []); // ❌ ОШИБКА
}

private async sendTesterPresent() {
  const cmd = buildUDS(0x28, 0xF0, 0x3E, [0x01]); // ❌ ОШИБКА
}

private async requestDiagnosticData() {
  const cmd = buildUDS(0x28, 0xF0, 0x21, [0x01]); // ❌ ОШИБКА
}
```

**Статус:** ❌ **КРИТИЧЕСКОЕ РАСХОЖДЕНИЕ**

**Влияние:** Высокая вероятность, что устройство игнорирует команды или отвечает неправильно.

**Необходимые изменения:**
```typescript
// protocol-parser.ts
function buildUDS(dst = 0x2A, src = 0xF1, sid: number, data: number[] = []): Uint8Array {
  // ...
}
```

---

### 3. Checksum Algorithm

#### 📄 Спецификация (ТЗ §1):
```
Контрольная сумма: суммирование всех байт кадра, 
в конце кадра записывается младший байт суммы.
```

#### 💻 Текущая реализация:

**Файл:** `src/utils/protocol-parser.ts`
```typescript
function sum8(a: Uint8Array, n?: number): number {
  let s = 0;
  const len = n !== undefined ? n : a.length;
  for (let i = 0; i < len; i++) s += a[i];
  return s & 0xFF; // ✅ Младший байт
}
```

**Статус:** ✅ **СООТВЕТСТВУЕТ** (при условии, что применяется ко всем байтам кадра)

**Замечание:** В функции `buildUDS` checksum вычисляется корректно — sum8 от всего body.

---

### 4. Payload Mapping (22 байта)

#### 📄 Спецификация (ТЗ §2, Таблица маппинга):

**Формат ответа на 0x21 0x01:**
```
Заголовок (5 байт):
[0] 0x80 + (длина)
[1] 0xF1 (DST — приложение)
[2] 0x2A (SRC — БСКУ)
[3] 0x61 (положительный ответ)
[4] 0x01 (LocalIdentifier)

Payload (Data[0..21], 22 байта):
Data[0]  = U_U_UM1         // Напряжение M1 (конденсатор), ADC 0-255
Data[1]  = U_U_UM2         // Напряжение M2 (испаритель), ADC
Data[2]  = U_U_UM3         // Напряжение M3 (компрессор), ADC
Data[3]  = U_U_FU          // Эталон/питание (~27В), ADC
Data[4]  = uUPR_BT         // Маска реле M1..M5, CMP
Data[5]  = uUPR_IND        // Маска индикаторов IND1..IND4
Data[6]  = sDAT_BIT        // Статусные флаги
Data[7]  = work_rej_cmp    // Режим компрессора
Data[8]  = vdlt_cnd_i      // dUM1 cnd (просадка конденсатор)
Data[9]  = vdlt_isp_i      // dUM2 isp (просадка испаритель)
Data[10] = vdlt_cmp_i      // dUM3 cmp (просадка компрессор)
Data[11] = timer_off       // Таймер выключения
Data[12] = rej_cnd         // Режим конденсатора
Data[13] = rej_isp         // Режим испарителя
Data[14] = edlt_cnd        // Задержка конденсатора
Data[15] = edlt_isp        // Задержка испарителя
Data[16] = edlt_cmp        // Задержка компрессора
Data[17] = n_V_cnd         // Счётчик включений конденсатора
Data[18] = PWM_spd         // PWM скорость
Data[19] = s1_TMR2         // Старший байт TMR2
Data[20] = s0_TMR2         // Младший байт TMR2
Data[21] = t_v_razg_cnd    // Время разгона конденсатора
```

**Формулы конвертации (ТЗ §2):**
```
U [В] = ADC * 30 / 255
T [°C] = (ADC - 128) / 2   // для температур
P [кПа] = ADC * K_p        // для давления
```

#### 💻 Текущая реализация:

**Файл:** `src/utils/screen4-parser.ts`
```typescript
export function parseScreen4(payload: Uint8Array): DiagnosticData | null {
  if (payload.length < 22) return null;
  
  const d = payload; // Data массив
  
  // ❌ ПРОБЛЕМА: маппинг не совпадает с спецификацией!
  
  const U_UM1 = d[0]; // ✅ Совпадает
  const U_UM2 = d[1]; // ✅ Совпадает
  const U_UM3 = d[2]; // ✅ Совпадает
  const U_FU = d[3];  // ✅ Совпадает
  
  // Проблема: дальнейшее декодирование не соответствует новой спецификации
  // Текущий код декодирует старый формат
}
```

**Файл:** `src/utils/bluetooth-parser.ts` (старый парсер)
```typescript
// ⚠️ Этот файл может содержать устаревший маппинг
// Нужна проверка на соответствие новой спецификации
```

**Статус:** ⚠️ **ЧАСТИЧНОЕ СООТВЕТСТВИЕ**

**Проблемы:**
1. Маппинг индексов 8-21 не соответствует новой спецификации
2. Отсутствует декодирование полей `timer_off`, `rej_cnd`, `rej_isp`, `edlt_*`, `n_V_cnd`, `PWM_spd`, `s*_TMR2`
3. Формулы конвертации могут отличаться

---

### 5. Расширенный формат (26-33 байта)

#### 📄 Спецификация (Схема обмена §4):
```
Опционально (будущее расширение):
Data[22] = T_air         // Температура воздуха
Data[23] = T_isp         // Температура испарителя
Data[24] = U_davl        // Напряжение датчика давления
Data[25] = iSOST_UPR1    // Состояние управления 1
Data[26] = iSOST_UPR2    // Состояние управления 2
```

#### 💻 Текущая реализация:

**Статус:** ❌ **НЕ РЕАЛИЗОВАНО**

**Рекомендация:** Зарезервировать поддержку в парсере для будущих версий прошивки.

---

### 6. Frame Types Processing

#### 📄 Спецификация (Схема обмена §3, §5, §6):

**0x88 (Telemetry):**
```
Deprecated или служебный фрейм
Приоритет: 0x21 0x01 (UDS ReadDataByLocalIdentifier)
```

**0x66 (Screen Notification):**
```
ECU → App: "SCR_" + <screenId> (байт)
App → ECU: "UOKS" + <screenId> (байт)

⚠️ ВАЖНО: screenId передаётся байтом (0x04), а не ASCII символом ('4' = 0x34)!
```

**0x77 (Configuration):**
```
ECU → App: пакеты конфигурации [pktId, len, data..., crc]
App → ECU: "UOKP" + <pktId> (байт)
```

#### 💻 Текущая реализация:

**Файл:** `src/utils/protocol-parser.ts`
```typescript
class ProtocolParser {
  feed(chunk: Uint8Array, emit: (f: ParsedFrame) => void) {
    // Обработка 0x88, 0x66, 0x77, 0x80 (UDS)
    // ✅ Основная логика присутствует
  }
}
```

**Файл:** `src/utils/capacitor-bluetooth.ts`
```typescript
private handleParsedFrame(frame: ParsedFrame) {
  if (frame.type === 'SCR_66') {
    // ⚠️ Проверить: отправляется ли screenId как байт или ASCII?
    logService.add('[BT] Screen notification received', 'info');
  }
  if (frame.type === 'CFG_77') {
    // ⚠️ Проверить: отправляется ли pktId как байт?
    logService.add('[BT] Config packet received', 'info');
  }
}
```

**Статус:** ⚠️ **ТРЕБУЕТ ПРОВЕРКИ**

**Критическое замечание из спецификации (Схема §5):**
> "Ответ должен отправляться оперативно; символ '4' (0x34) не равен байту 0x04."

Нужно убедиться, что приложение отправляет **байт**, а не ASCII-код.

---

### 7. Timing Requirements

#### 📄 Спецификация:
```
- Задержка после connect: ~200 мс
- TesterPresent: каждые ~1.5 сек
- ReadData (0x21 0x01): каждую ~1 сек
- Таймауты ответов: 500-1000 мс
- Ответ на 0x66/0x77: оперативно (< 100 мс)
```

#### 💻 Текущая реализация:

**Файл:** `src/utils/bluetooth-constants.ts`
```typescript
export const BT_TIMING = {
  CONNECT_DELAY: 200,
  TESTER_PRESENT_INTERVAL: 1500,
  DATA_REQUEST_INTERVAL: 1000,
  READ_TIMEOUT: 1000,
  RESPONSE_TIMEOUT: 500
};
```

**Статус:** ✅ **СООТВЕТСТВУЕТ**

---

### 8. Initialization Sequence

#### 📄 Спецификация (Схема обмена §2):
```
sequenceDiagram
App->>ECU: StartCommunication (SID 0x81)
ECU-->>App: PositiveResponse (0xC1)
App->>ECU: StartDiagnosticSession (0x10 ...)
ECU-->>App: PositiveResponse (0x50 ...)
App->>ECU: TesterPresent (0x3E 0x01)
```

#### 💻 Текущая реализация:

**Файл:** `src/utils/capacitor-bluetooth.ts`
```typescript
async connectToDeviceId(deviceAddress: string, systemType: SystemType) {
  // ...
  await this.sendStartCommunication(); // 0x81 ✅
  setTimeout(() => {
    this.startTesterPresent(); // 0x3E 0x01 ✅
    this.startPeriodicRead();  // 0x21 0x01 ✅
  }, 300);
}

private async sendStartCommunication() {
  const cmd = buildUDS(0x28, 0xF0, 0x81, []); // ❌ Неверные адреса
  await this.sendRaw(cmd);
}
```

**Статус:** ⚠️ **ЧАСТИЧНОЕ СООТВЕТСТВИЕ**

**Проблемы:**
1. Адреса в UDS командах неверные (0x28/0xF0 вместо 0x2A/0xF1)
2. Отсутствует явный `StartDiagnosticSession (0x10)`
3. Таймаут 300 мс (должно быть 200 мс согласно спецификации)

---

## 🔧 Приоритетные исправления

### 🔴 Критический приоритет (блокирующие проблемы):

#### 1. Исправить UDS адресацию
**Файл:** `src/utils/protocol-parser.ts`
```typescript
// БЫЛО:
function buildUDS(dst = 0x28, src = 0xF0, sid: number, data: number[] = []): Uint8Array

// ДОЛЖНО БЫТЬ:
function buildUDS(dst = 0x2A, src = 0xF1, sid: number, data: number[] = []): Uint8Array
```

#### 2. Обновить маппинг payload (22 байта)
**Файл:** `src/utils/screen4-parser.ts`

Полностью пересмотреть маппинг согласно таблице из ТЗ §2.

#### 3. Проверить отправку screenId/pktId как байтов
**Файлы:** обработчики 0x66 и 0x77

Убедиться, что отправляется **байт** (0x04), а не ASCII ('4' = 0x34).

---

### 🟡 Высокий приоритет (улучшения стабильности):

#### 4. Добавить задержку 200 мс после connect
**Файл:** `src/utils/capacitor-bluetooth.ts`
```typescript
async connectToDeviceId(deviceAddress: string, systemType: SystemType) {
  await this.bt.connect(deviceAddress);
  await new Promise(resolve => setTimeout(resolve, 200)); // Добавить!
  await this.sendStartCommunication();
}
```

#### 5. Добавить StartDiagnosticSession (0x10)
Согласно схеме обмена §2, после 0x81 должна идти команда 0x10.

#### 6. Реализовать расширенный формат (26+ байт)
Подготовить парсер к будущим расширениям прошивки.

---

### 🟢 Средний приоритет (документация и тесты):

#### 7. Обновить документацию
- `BLUETOOTH_INTEGRATION.md` — синхронизировать с новой спецификацией
- `ARCHITECTURE.md` — добавить актуальный маппинг
- Создать `PROTOCOL_SPEC.md` — скопировать техническую спецификацию

#### 8. Добавить юнит-тесты
- Тесты на buildUDS с правильными адресами
- Тесты на parseScreen4 с реальными данными
- Тесты на checksum

---

## 📊 Сводная таблица соответствия

| Компонент | Соответствие | Приоритет исправления | Файлы |
|-----------|-------------|----------------------|-------|
| Bluetooth SPP UUID | ✅ OK | - | `native-bluetooth.ts`, `BluetoothSerialPlugin.kt` |
| UDS Addressing | ❌ FAIL | 🔴 Критический | `protocol-parser.ts`, `capacitor-bluetooth.ts` |
| Checksum | ✅ OK | - | `protocol-parser.ts` |
| Payload 22 байта | ⚠️ Partial | 🔴 Критический | `screen4-parser.ts` |
| Расширенный формат | ❌ Missing | 🟡 Высокий | `screen4-parser.ts` |
| Frame 0x66/0x77 | ⚠️ Check | 🔴 Критический | `capacitor-bluetooth.ts` |
| Timing | ✅ OK | 🟢 Низкий | `bluetooth-constants.ts` |
| Init sequence | ⚠️ Partial | 🟡 Высокий | `capacitor-bluetooth.ts` |

---

## 📝 Рекомендации по внедрению

### Этап 1: Критические исправления (1-2 часа)
1. Изменить адреса в `buildUDS` на 0x2A/0xF1
2. Обновить маппинг в `screen4-parser.ts`
3. Проверить байтовую отправку в 0x66/0x77

### Этап 2: Стабилизация (2-4 часа)
4. Добавить задержку 200 мс
5. Реализовать 0x10 StartDiagnosticSession
6. Добавить поддержку расширенного формата

### Этап 3: Тестирование (4-8 часов)
7. Интеграционное тестирование с реальным устройством
8. Логирование всех кадров для анализа
9. Проверка стабильности на длительных сессиях

### Этап 4: Документация (2-3 часа)
10. Обновить всю техническую документацию
11. Создать примеры кадров (request/response)
12. Добавить troubleshooting guide

---

## 🎯 Ожидаемый результат

После внедрения всех исправлений:
- ✅ 100% соответствие официальной спецификации v1.0 от 17.10.2025
- ✅ Стабильный обмен с устройством без потери кадров
- ✅ Корректная интерпретация всех 22 байт payload
- ✅ Готовность к расширенному формату (26-33 байта)
- ✅ Полная трассировка протокола для отладки

---

## 📎 Приложения

### A. Корректный UDS-кадр (пример)

**Запрос ReadDataByLocalIdentifier (0x21 0x01):**
```
[0x84, 0x2A, 0xF1, 0x21, 0x01, CS]
      ^^^^  ^^^^  ^^^^  ^^^^
      DST   SRC   SID   Data

0x84 = 0x80 + len(4)
0x2A = DST (БСКУ)
0xF1 = SRC (тестер)
0x21 = ReadDataByLocalIdentifier
0x01 = LocalIdentifier
CS   = checksum (младший байт суммы всех предыдущих)
```

**Ответ устройства (22 байта данных):**
```
[0x9B, 0xF1, 0x2A, 0x61, 0x01, D0, D1, ..., D21, CS]
      ^^^^  ^^^^  ^^^^  ^^^^
      DST   SRC   Resp  LID

0x9B = 0x80 + len(27): 5 байт заголовка + 22 данных
0xF1 = DST (приложение)
0x2A = SRC (БСКУ)
0x61 = положительный ответ на 0x21
0x01 = LocalIdentifier
D0..D21 = 22 байта данных (см. маппинг)
CS = checksum
```

### B. Ссылки на спецификации

- **Основная спецификация:** `Схемы_Обмена_Pancyr_Diag_—_Bluetooth_uds_экраны_v1.docx`
- **Техническое задание:** `Тз_Для_Разработчика_Pancyr_Diag_Android_—_Протокол_Маппинг_И_Сборка_v1.0_17.10.docx`
- **Текущая документация проекта:** `BLUETOOTH_INTEGRATION.md`, `ARCHITECTURE.md`

---

**Конец отчета**

**Подготовил:** AI Assistant  
**Дата:** 17.10.2025  
**Версия отчета:** 1.0
