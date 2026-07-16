import { HandLandmarker, FilesetResolver } from "./vision_bundle.mjs";
const video=document.getElementById("webcam");
const status=document.getElementById("status");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
let handLandmarker;

async function getCamera(){
    const stream=await navigator.mediaDevices.getUserMedia({video:true});
    video.srcObject=stream;
    await new Promise((resolve)=>{
        video.onloadedmetadata=()=>resolve();
    });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;  
}

async function loadHandLandmarker(){
    const vision=await FilesetResolver.forVisionTasks("./wasm");
    handLandmarker=await HandLandmarker.createFromOptions(vision,
        {baseOptions:{modelAssetPath:"./hand_landmarker.task"},
        runningMode:"VIDEO",
        numHands:2});
}

function detectHands(){
    const result=handLandmarker.detectForVideo(video,performance.now());
    console.log(result)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    if(result.landmarks.length){
        status.textContent=`Hand(s) detected: ${result.landmarks.length}`;
        let hand=result.landmarks[0];
        
        const HAND_CONNECTIONS = [
            [0,1],[1,2],[2,3],[3,4],       // thumb
            [0,5],[5,6],[6,7],[7,8],       // index
            [5,9],[9,10],[10,11],[11,12],  // middle
            [9,13],[13,14],[14,15],[15,16],// ring
            [13,17],[17,18],[18,19],[19,20],// pinky
            [0,17]                          // palm base
            ];
        for(let pair of HAND_CONNECTIONS){
                let start=pair[0];
                let end=pair[1];
                ctx.moveTo((hand[start].x)*(canvas.width),(hand[start].y)*(canvas.height));
                ctx.lineTo((hand[end].x)*(canvas.width),(hand[end].y)*(canvas.height));
                ctx.stroke();
            }
            
        for(let i=0;i<21;i++){
        let color,prev_x,prev_y;
        if(i<5){color="yellow";}
        else if(i<9){color="blue";}
        else if(i<13){color="red";}
        else if(i<17){color="green";}
        else{color="orange";}

        let x_coord=(hand[i].x)*(canvas.width);
        let y_coord=(hand[i].y)*(canvas.height);
        ctx.beginPath()
        ctx.arc(x_coord,y_coord,3,0,6.28);
        ctx.fillStyle=color;
        ctx.fill();
        }   
    }
    else{status.textContent="No Hand Detected.";}
    requestAnimationFrame(detectHands);
}

async function main(){
    await getCamera();
    await loadHandLandmarker();
    status.textContent="Ready";
    detectHands();
}
main();