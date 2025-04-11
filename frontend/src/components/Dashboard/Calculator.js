import React, { useState } from 'react';
import { evaluate } from 'mathjs';

const ScientificCalculator = () => {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');

  const handleClick = (value) => {
    if (value === 'C') {
      setExpression('');
      setResult('');
    } else if (value === '=') {
      try {
        const evalResult = evaluate(expression);
        setResult(evalResult.toString());
      } catch {
        setResult('Error');
      }
    } else {
      const updatedValue = value === 'π' ? 'pi' : value;
      setExpression((prev) => prev + updatedValue);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Calculator</h2>
      <input
        value={expression}
        readOnly
        style={styles.input}
      />
      <div style={styles.result}>
  Result: <span style={styles.resultValue}>{result}</span>
</div>


      <div style={styles.keypad}>
        {[
          '7', '8', '9', '/', 'π',
          '4', '5', '6', '*', '√(',
          '1', '2', '3', '-', 'log(',
          '0', '.', '=', '+', 'sin(',
          'cos(', 'tan(', '(', ')', 'C'
        ].map((btn, i) => (
          <button key={i} onClick={() => handleClick(btn)} style={styles.button}>
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'white',
    padding: '2rem',
    borderRadius: '12px',
    width: '400px',
    margin: '2rem auto',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  title: {
    marginBottom: '10px',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '1.2rem',
    marginBottom: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
  },
  result: {
    marginBottom: '20px',
    fontWeight: 'bold',
    fontSize: '1.2rem',
    color: '#34495e',
  },
  resultValue: {
    fontWeight: 'normal',
    fontSize: '1.6rem',
    color: '#2c3e50',
  },
  
  keypad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '10px',
    marginBottom: '1rem'
  },
  button: {
    padding: '10px',
    fontSize: '1rem',
    background: '#eee',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
};

export default ScientificCalculator;
