import React, { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Scrollbar, A11y, Mousewheel } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/scrollbar';

const MathSolver = () => {
  const [output, setOutput] = useState('Waiting for input...');
  const [solutions, setSolutions] = useState([]);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const swiperRef = useRef(null);

  // Initialize camera on component mount
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setOutput("Camera access denied or not supported.");
      }
    };

    initializeCamera();
    fetchSolutions();

    // Cleanup camera stream on unmount
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Fetch solutions from the Flask API
  const fetchSolutions = async () => {
    try {
      const response = await fetch('http://localhost:8000/get-solutions');
      const data = await response.json();
      if (data.solutions) {
        setSolutions(data.solutions);
      } else {
        console.error('Error:', data.error);
        setOutput("Failed to load previous solutions.");
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setOutput("Error fetching solutions.");
    }
  };

  // Capture photo and send to backend
  const capture = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg');

    setOutput("⏳ Processing...");

    try {
      const res = await fetch('http://localhost:8000/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });
      const data = await res.json();
      setOutput(data.text || "❌ No text found!");
      fetchSolutions(); // Refresh solutions after new submission
    } catch (err) {
      console.error("Error:", err);
      setOutput("❌ Failed to extract text.");
    }
  };

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  return (
    <div style={styles.container}>
      {/* Left Sidebar with Slider */}
      <div 
        style={{
          ...styles.sidebar,
          transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
          width: sidebarVisible ? '500px' : '0',
          marginRight: sidebarVisible ? '20px' : '0'
        }}
      >
        <button 
          style={styles.toggleButton} 
          onClick={toggleSidebar}
        >
          {sidebarVisible ? 'Hide Solutions' : 'Show Solutions'}
        </button>
        <h3 style={styles.heading}>📚 Previous Solutions</h3>
        <div style={styles.swiperContainer}>
          <Swiper
            ref={swiperRef}
            modules={[Navigation, Pagination, Scrollbar, A11y, Mousewheel]}
            direction="vertical"
            slidesPerView="auto"
            spaceBetween={10}
            navigation
            pagination={{ clickable: true }}
            mousewheel
            style={styles.swiper}
          >
            {solutions.map((solution, index) => (
              <SwiperSlide key={index} style={styles.swiperSlide}>
                <img 
                  src={solution.image_data} 
                  alt="Math Problem" 
                  style={styles.slideImage}
                />
                <p style={styles.slideText}>{solution.result_text}</p>
                <div style={styles.timestamp}>
                  {new Date(solution.timestamp).toLocaleString()}
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        <h2 style={styles.heading}>📷 Live Camera Feed</h2>

        <video 
          ref={videoRef} 
          style={styles.video} 
          width="400" 
          height="300" 
          autoPlay 
          playsInline
        ></video>
        <canvas 
          ref={canvasRef} 
          style={styles.canvas} 
          width="400" 
          height="300"
        ></canvas>

        <br />
        <button style={styles.captureButton} onClick={capture}>
          📸 Capture & Extract Text
        </button>

        <h3 style={styles.heading}>📝 OUTPUT FOR THE PROBLEM:</h3>
        <pre style={styles.output}>{output}</pre>
      </div>
    </div>
  );
};

// CSS styles
const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f5f5f5',
    padding: '20px',
    margin: 0,
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    maxWidth: '1200px',
    margin: 'auto',
  },
  sidebar: {
    transition: 'transform 0.3s ease, width 0.3s ease, margin-right 0.3s ease',
    overflow: 'hidden',
  },
  mainContent: {
    flexGrow: 1,
    textAlign: 'center',
  },
  heading: {
    color: '#333',
  },
  video: {
    border: '2px solid #555',
    borderRadius: '10px',
    width: '400px',
    height: '300px',
    backgroundColor: '#000',
  },
  canvas: {
    display: 'none',
  },
  captureButton: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    margin: '10px 0',
  },
  toggleButton: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '20px',
  },
  output: {
    backgroundColor: '#fff',
    padding: '15px',
    width: '80%',
    margin: '20px auto',
    border: '1px solid #ccc',
    borderRadius: '6px',
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    minHeight: '100px',
  },
  swiperContainer: {
    width: '100%',
    height: 'calc(100vh - 150px)',
  },
  swiper: {
    width: '100%',
    height: '100%',
  },
  swiperSlide: {
    background: 'white',
    borderRadius: '10px',
    padding: '15px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: 'auto',
  },
  slideImage: {
    maxWidth: '100%',
    maxHeight: '80px',
    objectFit: 'contain',
    marginBottom: '10px',
  },
  slideText: {
    margin: 0,
    fontSize: '13px',
    overflowY: 'auto',
    flexGrow: 1,
  },
  timestamp: {
    fontSize: '11px',
    color: '#888',
    textAlign: 'right',
    marginTop: '5px',
  },
};

export default MathSolver;