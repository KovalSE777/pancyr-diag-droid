import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Wrench, AlertTriangle, CheckCircle2, Fan, Zap, Thermometer } from "lucide-react";
import { useState } from "react";
import patternBg from "@/assets/pattern-bg.jpg";

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
    title: 'Отказ предохранителя Pr1 (10 ампер)',
    category: 'fuse',
    severity: 'warning',
    symptoms: ['При подаче питания система не включается'],
    diagnosis: 'Проверить напряжение на блоке предохранителей и заменить в случае неисправности предохранитель pr1 на 10 ампер',
    solution: [
      'Выключить питание системы',
      'Добраться до блока предохранителей предварительно разобрав корпус БСКУ',
      'Проверить мультиметром целостность предохранителя',
      'Заменить предохранитель на аналогичный',
      'Включить питание и проверить напряжение'
    ],
    tools: ['Мультиметр', 'Шуруповерт', 'Предохранитель 10 А', 'Шестигранный ключ']
  },
  {
    id: 'fuse_pr2',
    title: 'Отказ предохранителя Pr2 (30 ампер)',
    category: 'fuse',
    severity: 'warning',
    symptoms: ['Вентиляторы конденсатора не работают'],
    diagnosis: 'Проверить напряжение на блоке предохранителей и заменить в случае неисправности предохранитель pr2 на 30 ампер',
    solution: [
      'Выключить питание системы',
      'Добраться до блока предохранителей предварительно разобрав корпус БСКУ',
      'Проверить мультиметром целостность предохранителя',
      'Заменить предохранитель на аналогичный',
      'Включить питание и проверить напряжение'
    ],
    tools: ['Мультиметр', 'Шуруповерт', 'Предохранитель 30 А', 'Шестигранный ключ']
  },
  {
    id: 'fuse_pr3',
    title: 'Отказ предохранителя Pr3 (30 ампер)',
    category: 'fuse',
    severity: 'warning',
    symptoms: ['Вентилятор испарителя не работает'],
    diagnosis: 'Проверить напряжение на блоке предохранителей и заменить в случае неисправности предохранитель pr3 на 30 ампер',
    solution: [
      'Выключить питание системы',
      'Добраться до блока предохранителей предварительно разобрав корпус БСКУ',
      'Проверить мультиметром целостность предохранителя',
      'Заменить предохранитель на аналогичный',
      'Включить питание и проверить напряжение'
    ],
    tools: ['Мультиметр', 'Шуруповерт', 'Предохранитель 30 А', 'Шестигранный ключ']
  },

  // ВЕНТИЛЯТОРЫ
  {
    id: 'fan_condenser',
    title: 'Неисправность вентиляторов конденсатора',
    category: 'fan',
    severity: 'warning',
    symptoms: ['Нет просадки напряжения dUM1 при подключении приложения для диагностики', 'Не включаются вентиляторы конденсатора'],
    diagnosis: 'Измерить просадку напряжения на цепи конденсатора при подключении приложения для диагностики. При исправных вентиляторах должна быть просадка > 0.5В. Не включаются один вентилятор конденсатора или все сразу.',
    solution: [
      'Подключить приложение для диагностики',
      'Проверить визуально вращение вентиляторов',
      'Измерить напряжение питания вентиляторов',
      'Проверить целостность проводки',
      'Проверить предохранитель Pr2',
      'При необходимости заменить вентилятор'
    ],
    tools: ['Мультиметр', 'Шуруповерт', 'Запасной вентилятор', 'Набор инструментов']
  },
  {
    id: 'evaporator_fan',
    title: 'Неисправность вентилятора испарителя',
    category: 'fan',
    severity: 'warning',
    symptoms: ['Нет просадки напряжения dUM2 при подключении приложения для диагностики', 'Слышен шум', 'Отсутствие охлаждения'],
    diagnosis: 'Проверить работу вентилятора испарителя. Измерить просадку напряжения dUM2.',
    solution: [
      'Проверить поток воздуха в автомобиле',
      'Проверка предохранителя Pr3',
      'Замена блока охлаждения в сборе при необходимости'
    ],
    tools: ['Мультиметр', 'Шуруповерт', 'Запасной вентилятор', 'Набор инструментов']
  },
  {
    id: 'compressor_fan',
    title: 'Неисправность вентилятора компрессора',
    category: 'fan',
    severity: 'warning',
    symptoms: ['Нет воздушного потока', 'Отсутствие питания', 'Механический дефект', 'Повреждение разъемов соединений'],
    diagnosis: 'Проверить работу охлаждения компрессора. Проверка питания. Механическая проверка вентилятора и соединений. Проверка предохранителя 15 А.',
    solution: [
      'Подключить приложение для диагностики',
      'Проверить вращение вентилятора в приложении принудительно через тест компонентов',
      'Визуальный осмотр вентилятора и проводки',
      'Проверка питания на предохранители 15 А',
      'Заменить вентилятор при необходимости'
    ],
    tools: ['Мультиметр', 'Шуруповерт', 'Запасной вентилятор', 'Набор инструментов']
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

  // Группировка по категориям
  const groupedRepairs = filteredRepairs.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, RepairItem[]>);

  const categoryOrder: Array<RepairItem['category']> = ['fuse', 'fan', 'compressor', 'sensor'];
  
  const getCategoryInfo = (category: string) => {
    switch (category) {
      case 'fuse': 
        return { 
          icon: <Zap className="w-6 h-6" />, 
          title: 'Предохранители',
          color: 'text-warning'
        };
      case 'fan': 
        return { 
          icon: <Fan className="w-6 h-6" />, 
          title: 'Вентиляторы',
          color: 'text-primary'
        };
      case 'compressor': 
        return { 
          icon: <Wrench className="w-6 h-6" />, 
          title: 'Компрессор',
          color: 'text-accent'
        };
      case 'sensor': 
        return { 
          icon: <Thermometer className="w-6 h-6" />, 
          title: 'Датчики',
          color: 'text-success'
        };
      default: 
        return { 
          icon: <AlertTriangle className="w-6 h-6" />, 
          title: 'Общее',
          color: 'text-muted-foreground'
        };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'fuse': return <Zap className="w-5 h-5" />;
      case 'fan': return <Fan className="w-5 h-5" />;
      case 'compressor': return <Wrench className="w-5 h-5" />;
      case 'sensor': return <Thermometer className="w-5 h-5" />;
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
    <div className="min-h-screen bg-background pb-16 relative overflow-hidden safe-top safe-bottom">
      {/* Multi-layer Optimized Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-30 bg-cover bg-center" style={{ backgroundImage: `url(${patternBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-background/90 to-background" />
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5" />
      </div>
      
      {/* Subtle glow */}
      <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      {/* Compact Header */}
      <header className="glass-header sticky top-0 z-50 relative">
        <div className="container mx-auto px-3 py-3">
          <div className="flex items-center justify-between mb-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="text-foreground hover:text-primary -ml-2"
              size="sm"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Назад
            </Button>
            <h1 className="text-2xl font-black gradient-text">База знаний</h1>
            <div className="w-16" />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 glass-card border-border/50 text-sm h-10"
            />
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-3 py-3 space-y-4 pb-20">
        {filteredRepairs.length === 0 ? (
          <Card className="premium-card p-16 text-center">
            <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-xl text-muted-foreground font-light">Ничего не найдено. Попробуйте другой запрос.</p>
          </Card>
        ) : (
          categoryOrder.map((category) => {
            const items = groupedRepairs[category];
            if (!items || items.length === 0) return null;
            
            const categoryInfo = getCategoryInfo(category);
            
            return (
              <div key={category} className="space-y-6">
                {/* Premium Category Header */}
                <div className="glass-card p-6 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className={`relative flex-shrink-0`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${categoryInfo.color === 'text-warning' ? 'from-warning/30' : categoryInfo.color === 'text-primary' ? 'from-primary/30' : categoryInfo.color === 'text-accent' ? 'from-accent/30' : 'from-success/30'} to-transparent rounded-2xl blur-xl`} />
                      <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${categoryInfo.color === 'text-warning' ? 'from-warning/20 to-warning/5' : categoryInfo.color === 'text-primary' ? 'from-primary/20 to-primary/5' : categoryInfo.color === 'text-accent' ? 'from-accent/20 to-accent/5' : 'from-success/20 to-success/5'} backdrop-blur-sm border ${categoryInfo.color === 'text-warning' ? 'border-warning/30' : categoryInfo.color === 'text-primary' ? 'border-primary/30' : categoryInfo.color === 'text-accent' ? 'border-accent/30' : 'border-success/30'} flex items-center justify-center ${categoryInfo.color}`}>
                        {categoryInfo.icon}
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-foreground">{categoryInfo.title}</h2>
                      <p className="text-sm text-muted-foreground font-light mt-1">{items.length} {items.length === 1 ? 'неисправность' : 'неисправности'}</p>
                    </div>
                  </div>
                </div>

                {/* Premium Repair Cards */}
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <Card 
                      key={item.id} 
                      className="group premium-card p-8 hover:scale-[1.02] animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex flex-col sm:flex-row items-start gap-6">
                        {/* Premium Icon */}
                        <div className="relative flex-shrink-0">
                          <div className={`absolute inset-0 ${getSeverityColor(item.severity) === 'text-warning' ? 'bg-warning/20' : 'bg-accent/20'} rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500`} />
                          <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${getSeverityColor(item.severity) === 'text-warning' ? 'from-warning/30 to-warning/10' : 'from-accent/30 to-accent/10'} backdrop-blur-sm border ${getSeverityColor(item.severity) === 'text-warning' ? 'border-warning/30' : 'border-accent/30'} flex items-center justify-center ${getSeverityColor(item.severity)} group-hover:scale-110 transition-transform duration-500`}>
                            {getCategoryIcon(item.category)}
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-5">
                          {/* Header */}
                          <div>
                            <h3 className="text-2xl font-black text-foreground mb-3 group-hover:text-primary transition-colors">{item.title}</h3>
                            <span className={`inline-flex items-center gap-2 text-xs px-4 py-1.5 rounded-full font-semibold ${
                              item.severity === 'warning' ? 'bg-warning/20 text-warning border border-warning/30' :
                              'bg-accent/20 text-accent border border-accent/30'
                            }`}>
                              {item.severity === 'warning' ? '⚠️ Внимание' : 'ℹ️ Информация'}
                            </span>
                          </div>

                          {/* Symptoms */}
                          <div className="glass-card p-4 rounded-xl">
                            <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-warning" />
                              Симптомы:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-2">
                              {item.symptoms.map((symptom, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-warning mt-1">▸</span>
                                  <span>{symptom}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Diagnosis */}
                          <div className="glass-card p-4 rounded-xl border-l-4 border-accent">
                            <p className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                              <Search className="w-4 h-4 text-accent" />
                              Диагностика:
                            </p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{item.diagnosis}</p>
                          </div>

                          {/* Solution */}
                          <div className="glass-card p-5 rounded-xl border-l-4 border-success">
                            <p className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-success" />
                              Пошаговое решение:
                            </p>
                            <ol className="text-sm text-muted-foreground space-y-3">
                              {item.solution.map((step, i) => (
                                <li key={i} className="flex gap-3">
                                  <span className="flex-shrink-0 w-7 h-7 rounded-xl bg-gradient-to-br from-success/30 to-success/10 border border-success/30 text-success flex items-center justify-center text-xs font-black">
                                    {i + 1}
                                  </span>
                                  <span className="pt-1">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          {/* Tools */}
                          <div>
                            <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                              <Wrench className="w-4 h-4 text-primary" />
                              Необходимые инструменты:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {item.tools.map((tool, i) => (
                                <span key={i} className="text-xs px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 text-foreground font-medium border border-primary/20 hover:border-primary/50 transition-colors">
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
};

export default RepairGuide;
