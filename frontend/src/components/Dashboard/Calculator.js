import React, { useState } from 'react';
import { evaluate } from 'mathjs'; // ✅ import from mathjs

const Calculator = () => {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');

  const handleCalculate = () => {
    try {
      const evalResult = evaluate(expression); // ✅ safer alternative
      setResult(evalResult.toString());
    } catch (error) {
      setResult('Error');
    }
  };

  return (
    <div className="calculator">
      <h3>Scientific Calculator</h3>
      <input
        type="text"
        placeholder="Enter expression"
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
      />
      <div className="calculator-buttons">
        <button onClick={handleCalculate}>Calculate</button>
        <button onClick={() => { setExpression(''); setResult(''); }}>Clear</button>
      </div>
      <div className="calculator-result">
        <strong>Result:</strong> {result}
      </div>
    </div>
  );
};

export default Calculator;
