import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Bluetooth, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import acSystemIcon from "@/assets/ac-system-icon.png";

const SystemSelect = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [systemType, setSystemType] = useState<'ska' | 'ske'>('ska');

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'ska' || type === 'ske') {
      setSystemType(type);
    }
  }, [searchParams]);

  const systemInfo = {
    ska: {
      title: 'СКА',
      fullName: 'Система кондиционирования аппаратуры',
      description: 'Диагностика аппаратурной части системы кондиционирования (3 вентилятора конденсатора)',
      color: 'primary',
      components: [
        'Блок силовой коммутации и управления (БСКУ)',
        'Агрегат компрессорно-конденсаторный',
        'Блок испарителя',
        'Коммутационная коробка с термостатом',
        '3 вентилятора конденсатора (M1, M2, M3)'
      ]
    },
    ske: {
      title: 'СКЭ',
      fullName: 'Система кондиционирования экипажа',
      description: 'Диагностика экипажной части системы кондиционирования (2 вентилятора конденсатора)',
      color: 'secondary',
      components: [
        'Блок силовой коммутации и управления (БСКУ)',
        'Агрегат конденсаторный',
        'Агрегат компрессорный',
        'Блок испарителя',
        'Пульт климат-контроль (ПКК)',
        'Коммутационная коробка',
        '2 вентилятора конденсатора (M1, M2)'
      ]
    }
  };

  const info = systemInfo[systemType];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="text-foreground hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{info.title}</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* System Info */}
        <Card className="mb-8 p-8 bg-card border-border animate-fade-in">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-32 h-32 flex-shrink-0">
              <img 
                src={acSystemIcon} 
                alt="AC System" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-bold mb-2 text-foreground">{info.fullName}</h2>
              <p className="text-lg text-muted-foreground mb-6">{info.description}</p>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Компоненты системы:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {info.components.map((component, index) => (
                    <li key={index}>• {component}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Connect Bluetooth */}
          <Card 
            className="group relative overflow-hidden bg-card border-border hover:border-primary transition-all duration-300 cursor-pointer animate-scale-in"
            onClick={() => navigate(`/bluetooth-connect?type=${systemType}`)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative p-8 flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Bluetooth className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
                  Подключиться
                </h3>
                <p className="text-muted-foreground">
                  Подключение к БСКУ<br />через Bluetooth
                </p>
              </div>
              <Button className="w-full bg-primary hover:bg-primary-glow mt-4">
                Начать диагностику
              </Button>
            </div>
          </Card>

          {/* Repair Guide */}
          <Card 
            className="group relative overflow-hidden bg-card border-border hover:border-accent transition-all duration-300 cursor-pointer animate-scale-in [animation-delay:100ms]"
            onClick={() => navigate(`/repair-guide?type=${systemType}`)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative p-8 flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="w-10 h-10 text-accent" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2 text-foreground group-hover:text-accent transition-colors">
                  Руководство
                </h3>
                <p className="text-muted-foreground">
                  База знаний<br />по ремонту
                </p>
              </div>
              <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground mt-4">
                Открыть справку
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SystemSelect;
