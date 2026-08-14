import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator as CalcIcon, Delete } from 'lucide-react';

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isNewNumber, setIsNewNumber] = useState(true);

  const handleNum = (num: string) => {
    if (isNewNumber) {
      setDisplay(num);
      setIsNewNumber(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOp = (op: string) => {
    if (!isNewNumber) {
      setEquation(equation + display + ' ' + op + ' ');
      setIsNewNumber(true);
    } else if (equation.length > 0) {
      setEquation(equation.slice(0, -2) + op + ' ');
    }
  };

  const calculate = () => {
    try {
      const fullEq = equation + display;
      // Using new Function instead of eval for slight safety, though still standard standard eval-like approach for simple calc
      const result = new Function('return ' + fullEq.replace(/×/g, '*').replace(/÷/g, '/'))();
      setDisplay(String(result));
      setEquation('');
      setIsNewNumber(true);
    } catch (e) {
      setDisplay('Error');
      setEquation('');
      setIsNewNumber(true);
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
    setIsNewNumber(true);
  };

  const del = () => {
    if (!isNewNumber) {
      setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
      if (display.length === 1) setIsNewNumber(true);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center justify-center gap-3">
          <CalcIcon className="w-8 h-8 text-primary" /> Calculator
        </h1>
        <p className="text-muted-foreground">Quick billing calculator</p>
      </div>

      <Card className="w-full max-w-sm shadow-xl bg-card border-2">
        <CardContent className="p-6">
          <div className="bg-muted/50 p-4 rounded-xl mb-6 flex flex-col items-end justify-end h-24 border border-border shadow-inner">
            <div className="text-sm text-muted-foreground h-6 tracking-wider font-mono">{equation}</div>
            <div className="text-4xl font-bold font-mono text-foreground tracking-tight overflow-hidden break-all">{display}</div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Button variant="destructive" className="col-span-2 font-bold text-lg" onClick={clear}>C (Clear)</Button>
            <Button variant="outline" className="font-bold text-lg border-primary/20 hover:bg-primary/10" onClick={del}>
              <Delete className="w-5 h-5" />
            </Button>
            <Button variant="default" className="font-bold text-xl bg-amber-500 hover:bg-amber-600 text-white" onClick={() => handleOp('/')}>÷</Button>

            <Button variant="outline" className="font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('7')}>7</Button>
            <Button variant="outline" className="font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('8')}>8</Button>
            <Button variant="outline" className="font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('9')}>9</Button>
            <Button variant="default" className="font-bold text-xl bg-amber-500 hover:bg-amber-600 text-white" onClick={() => handleOp('*')}>×</Button>

            <Button variant="outline" className="font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('4')}>4</Button>
            <Button variant="outline" className="font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('5')}>5</Button>
            <Button variant="outline" className="font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('6')}>6</Button>
            <Button variant="default" className="font-bold text-2xl bg-amber-500 hover:bg-amber-600 text-white" onClick={() => handleOp('-')}>-</Button>

            <Button variant="outline" className="font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('1')}>1</Button>
            <Button variant="outline" className="font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('2')}>2</Button>
            <Button variant="outline" className="font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('3')}>3</Button>
            <Button variant="default" className="font-bold text-2xl bg-amber-500 hover:bg-amber-600 text-white" onClick={() => handleOp('+')}>+</Button>

            <Button variant="outline" className="col-span-2 font-bold text-2xl h-14 bg-background shadow-sm" onClick={() => handleNum('0')}>0</Button>
            <Button variant="outline" className="font-bold text-3xl h-14 bg-background shadow-sm" onClick={() => handleNum('.')}>.</Button>
            <Button variant="default" className="font-bold text-2xl h-14 shadow-md bg-emerald-500 hover:bg-emerald-600 text-white" onClick={calculate}>=</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
