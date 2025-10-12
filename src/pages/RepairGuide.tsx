import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Wrench, AlertTriangle, CheckCircle2, Fan, Zap } from "lucide-react";
import { useState } from "react";

interface RepairItem {
  id: string;
  title: string;
  category: 'fuse' | 'fan' | 'compressor' | 'sensor' | 'general';
  severity: 'critical' | 'warning' | 'info';
  symptoms: string[];
  diagnosis: string;
  solution: string[];
  tools: string[];
}

const repairData: RepairItem[] = [
  // ПРЕДОХРАНИТЕЛИ
  {
    id: 'fuse_pr1',
    title: 'Отказ предохранителя Pr1 (Эталон)',
    category: 'fuse',
    severity: 'warning',
    symptoms: ['Нет эталонного напряжения', 'Плата управления не работает'],
    diagnosis: 'Проверить напряжение на предохранителе Pr1. Должно быть 27В.',
    solution: [
      'Выключить питание системы',
      'Визуально осмотреть предохранитель на предмет повреждений',
      'Проверить мультиметром целостность предохранителя',
      'Заменить предохранитель на аналогичный',
      'Включить питание и проверить напряжение'
    ],
    tools: ['Мультиметр', 'Отвертка', 'Предохранитель 27В']
  },
  {
    id: 'fuse_pr2',
    title: 'Отказ предохранителя Pr2 (Конденсатор)',
    category: 'fuse',
    severity: 'warning',
    symptoms: ['Вентиляторы конденсатора не работают', 'Перегрев системы'],
    diagnosis: 'Проверить целостность предохранителя Pr2. Проверить цепь питания вентиляторов конденсатора.',
    solution: [
      'Выключить питание',
      'Проверить предохранитель мультиметром',
      'Осмотреть проводку на короткое замыкание',
      'Заменить предохранитель',
      'Проверить работу вентиляторов'
    ],
    tools: ['Мультиметр', 'Отвертка', 'Предохранитель']
  },
  {
    id: 'fuse_pr3',
    title: 'Отказ предохранителя Pr3 (Испаритель)',
    category: 'fuse',
    severity: 'warning',
    symptoms: ['Вентилятор испарителя не работает', 'Слабое охлаждение'],
    diagnosis: 'Проверить целостность предохранителя Pr3. Проверить цепь питания вентилятора испарителя.',
    solution: [
      'Отключить питание',
      'Проверить предохранитель',
      'Проверить двигатель вентилятора на короткое замыкание',
      'Заменить предохранитель',
      'Включить и проверить работу'
    ],
    tools: ['Мультиметр', 'Отвертка', 'Предохранитель']
  },

  // ВЕНТИЛЯТОРЫ
  {
    id: 'fan_condenser',
    title: 'Неисправность вентиляторов конденсатора',
    category: 'fan',
    severity: 'warning',
    symptoms: ['Нет просадки напряжения dUM1', 'Слышен шум', 'Перегрев системы'],
    diagnosis: 'Измерить просадку напряжения на цепи конденсатора. При исправных вентиляторах должна быть просадка > 0.5В.',
    solution: [
      'Проверить визуально вращение вентиляторов',
      'Измерить напряжение питания вентиляторов',
      'Проверить целостность проводки',
      'Проверить предохранитель Pr2',
      'При необходимости заменить вентилятор'
    ],
    tools: ['Мультиметр', 'Отвертка', 'Запасной вентилятор']
  },
  {
    id: 'evaporator_fan',
    title: 'Неисправность вентилятора испарителя',
    category: 'fan',
    severity: 'warning',
    symptoms: ['Нет воздушного потока', 'Нет просадки dUM2', 'Слабое охлаждение'],
    diagnosis: 'Проверить работу вентилятора испарителя. Измерить просадку напряжения dUM2.',
    solution: [
      'Проверить вращение вентилятора',
      'Очистить крыльчатку от загрязнений',
      'Проверить целостность обмоток двигателя',
      'Проверить предохранитель Pr3',
      'Заменить вентилятор при необходимости'
    ],
    tools: ['Мультиметр', 'Щетка для очистки', 'Запасной вентилятор']
  },
  {
    id: 'compressor_fan',
    title: 'Неисправность вентилятора компрессора',
    category: 'fan',
    severity: 'warning',
    symptoms: ['Перегрев компрессора', 'Срабатывание термореле', 'Нет воздушного потока'],
    diagnosis: 'Проверить работу вентилятора охлаждения компрессора. Проверить температуру компрессора.',
    solution: [
      'Проверить вращение вентилятора',
      'Очистить радиатор и крыльчатку от пыли',
      'Проверить питание вентилятора',
      'Проверить термореле на срабатывание',
      'Заменить вентилятор при необходимости'
    ],
    tools: ['Мультиметр', 'Щетка для очистки', 'Термометр', 'Запасной вентилятор']
  },

  // КОМПРЕССОР
  {
    id: 'compressor_fail',
    title: 'Компрессор не запускается',
    category: 'compressor',
    severity: 'warning',
    symptoms: ['Компрессор не запускается', 'Нет охлаждения', 'Индикация ошибки UCP'],
    diagnosis: 'Проверить последовательность сигналов УПП (устройство плавного пуска): 1) SVD - сигнал с фотодиода, 2) Контакт норма.',
    solution: [
      'Проверить питание 380В на жгуте компрессора',
      'Проверить сигнал SVD с фотодиода на плате',
      'Проверить сигнал "Контакт норма" после SVD',
      'Проверить целостность жгута проводов',
      'Проверить саму плату управления на дефекты',
      'Проверить устройство плавного пуска (УПП)',
      'При необходимости заменить неисправный компонент'
    ],
    tools: ['Мультиметр', 'Осциллограф', 'Отвертка', 'Схема подключения']
  },
  {
    id: 'compressor_wiring',
    title: 'Проблемы с жгутом компрессора',
    category: 'compressor',
    severity: 'warning',
    symptoms: ['Нестабильная работа', 'Компрессор периодически отключается', 'Ошибки связи'],
    diagnosis: 'Проверить жгут проводов компрессора на повреждения. Проверить напряжение 380В.',
    solution: [
      'Визуально осмотреть жгут на механические повреждения',
      'Проверить напряжение 380В на входе в компрессор',
      'Проверить целостность каждого провода мультиметром',
      'Проверить качество контактов и соединений',
      'При обнаружении повреждений - заменить жгут'
    ],
    tools: ['Мультиметр', 'Отвертка', 'Изолента', 'Запасной жгут']
  },
  {
    id: 'compressor_mechanical',
    title: 'Механическая неисправность компрессора',
    category: 'compressor',
    severity: 'warning',
    symptoms: ['Посторонний шум', 'Вибрация', 'Компрессор не создает давление'],
    diagnosis: 'Проверить механическое состояние компрессора. Проверить давление в системе.',
    solution: [
      'Отключить питание системы',
      'Проверить манометром давление в системе',
      'Проверить наличие утечек хладагента',
      'Проверить масло в компрессоре',
      'При серьезных повреждениях - замена компрессора'
    ],
    tools: ['Манометр', 'Течеискатель', 'Ключи', 'Масло для компрессора']
  },

  // ДАТЧИКИ
  {
    id: 'pressure_sensor',
    title: 'Отказ датчика давления',
    category: 'sensor',
    severity: 'warning',
    symptoms: ['Индикация IDD не горит', 'Компрессор не включается'],
    diagnosis: 'Проверить наличие сигнала от датчика давления. При исправном датчике должна гореть индикация.',
    solution: [
      'Проверить электрическое подключение датчика',
      'Проверить механическое крепление',
      'Измерить сопротивление датчика',
      'Проверить давление в системе манометром',
      'Заменить датчик при необходимости'
    ],
    tools: ['Мультиметр', 'Манометр', 'Отвертка', 'Запасной датчик']
  },
  {
    id: 'temperature_sensor',
    title: 'Неисправность датчика температуры',
    category: 'sensor',
    severity: 'warning',
    symptoms: ['Неверные показания температуры', 'Система не держит заданную температуру'],
    diagnosis: 'Проверить показания датчика температуры. Сравнить с реальной температурой.',
    solution: [
      'Проверить подключение датчика',
      'Измерить сопротивление датчика при известной температуре',
      'Сравнить с таблицей характеристик датчика',
      'Проверить целостность проводки',
      'Заменить датчик при отклонениях'
    ],
    tools: ['Мультиметр', 'Термометр', 'Таблица характеристик', 'Запасной датчик']
  },
  {
    id: 'photodiode_sensor',
    title: 'Неисправность фотодиода (SVD сигнал)',
    category: 'sensor',
    severity: 'warning',
    symptoms: ['Нет сигнала SVD', 'Компрессор не получает команду запуска', 'УПП не активируется'],
    diagnosis: 'Проверить наличие сигнала SVD от фотодиода. Это первый сигнал в последовательности запуска компрессора.',
    solution: [
      'Проверить питание фотодиода',
      'Очистить оптическую часть фотодиода',
      'Проверить уровень сигнала на выходе',
      'Проверить целостность проводки к плате',
      'Заменить фотодиод при отсутствии сигнала'
    ],
    tools: ['Мультиметр', 'Осциллограф', 'Салфетка для оптики', 'Запасной фотодиод']
  }
];

const RepairGuide = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  
  const systemType = searchParams.get('type') || 'ska';

  const filteredRepairs = repairData.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.symptoms.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'fuse': return <Zap className="w-5 h-5" />;
      case 'fan': return <Fan className="w-5 h-5" />;
      case 'compressor': return <Wrench className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive';
      case 'warning': return 'text-warning';
      default: return 'text-accent';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="text-foreground hover:text-primary"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
            <h1 className="text-2xl font-bold text-foreground">База знаний</h1>
            <div className="w-24" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Поиск по симптомам или названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {filteredRepairs.length === 0 ? (
          <Card className="p-12 text-center bg-card border-border">
            <p className="text-muted-foreground">Ничего не найдено. Попробуйте другой запрос.</p>
          </Card>
        ) : (
          filteredRepairs.map((item, index) => (
            <Card 
              key={item.id} 
              className="p-6 bg-card border-border hover:border-primary transition-all duration-300 animate-fade-in cursor-pointer"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center ${getSeverityColor(item.severity)}`}>
                  {getCategoryIcon(item.category)}
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                    <div className="flex gap-2 mb-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        item.severity === 'warning' ? 'bg-warning/20 text-warning' :
                        'bg-accent/20 text-accent'
                      }`}>
                        {item.severity === 'warning' ? 'Внимание' : 'Инфо'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Симптомы:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {item.symptoms.map((symptom, i) => (
                        <li key={i}>• {symptom}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Диагностика:</p>
                    <p className="text-sm text-muted-foreground">{item.diagnosis}</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      Решение:
                    </p>
                    <ol className="text-sm text-muted-foreground space-y-2">
                      {item.solution.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Необходимые инструменты:</p>
                    <div className="flex flex-wrap gap-2">
                      {item.tools.map((tool, i) => (
                        <span key={i} className="text-xs px-3 py-1 rounded-full bg-accent/20 text-accent">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};

export default RepairGuide;
