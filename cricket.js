import { HandLandmarker, FilesetResolver } from "./vision_bundle.mjs";

const video=document.getElementById("webcam");
const status=document.getElementById("status");
const canvas = document.getElementById("overlay");
const countdownelement=document.getElementById("countdown");
const usermove=document.getElementById("usermove");
const computermove=document.getElementById("computermove");
const playerPoints=document.getElementById("playerPoints");
const computerPoints=document.getElementById("computerPoints");
const roundResultDisplay=document.getElementById("roundResultDisplay");
const finalResult=document.getElementById("finalResult");
const finalScore=document.getElementById("finalScore");
const tossChoice = document.getElementById("tossChoice");
const batFirstBtn = document.getElementById("batFirstBtn");
const bowlFirstBtn = document.getElementById("bowlFirstBtn");


const batterLabel = document.getElementById("batterLabel");
const halfLabel = document.getElementById("halfLabel");
const liveScore = document.getElementById("liveScore");
const targetLine = document.getElementById("targetLine");
const endPanel = document.getElementById("endPanel");


const ctx = canvas.getContext("2d");

let handLandmarker;
let gamePhase,phaseStartTime;
let computerChoice,playerChoice;
let moveCaptured,computersChoiceSelected,roundResultSet;
let roundResult;
let frameFrozen;
let currentBatter; 
let target = null; 
let batterScore=0;

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

function getDistance(hand,indexA,indexB){
    let dx=hand[indexA].x-hand[indexB].x;
    let dy=hand[indexA].y-hand[indexB].y;
    return Math.sqrt(dx*dx+dy*dy);
}

function isFingerExtendedByDistance(hand,tipIndex,knuckleIndex){
    const tipDist = getDistance(hand, tipIndex, 0);
    const knuckleDist = getDistance(hand, knuckleIndex, 0);
    return tipDist > knuckleDist * 1.1; // 1.1 = small margin to avoid noise at the threshold
}

function getFingerState(hand) {
    return {
        thumb: getDistance(hand, 4, 17) > getDistance(hand, 2, 17) * 1.1, //checking if closer to pinky bcs thumb folds sideways
        index: isFingerExtendedByDistance(hand, 8, 6),
        middle: isFingerExtendedByDistance(hand, 12, 10),
        ring: isFingerExtendedByDistance(hand, 16, 14),
        pinky: isFingerExtendedByDistance(hand, 20, 18)
    };
}

function recogniseGesture(hand){
    let gesture=getFingerState(hand);
    if( !gesture.thumb && gesture.index && !gesture.middle && !gesture.ring && !gesture.pinky ){
        playerChoice=1;
    }
    else if(!gesture.thumb && gesture.index && gesture.middle && !gesture.ring && !gesture.pinky){
        playerChoice=2;
    }
    else if(!gesture.thumb && gesture.index && gesture.middle && gesture.ring && !gesture.pinky){
        playerChoice=3;
    }
    else if(!gesture.thumb && gesture.index && gesture.middle && gesture.ring && gesture.pinky){
        playerChoice=4;
    }
    else if(gesture.thumb && gesture.index && gesture.middle && gesture.ring && gesture.pinky){
        playerChoice=5;
    }
    else if(gesture.thumb && !gesture.index && !gesture.middle && !gesture.ring && !gesture.pinky){
        playerChoice=6;
    }
    else if(gesture.thumb && gesture.index && !gesture.middle && !gesture.ring && !gesture.pinky){
        playerChoice=7;
    }
    else if(gesture.thumb && gesture.index && gesture.middle && !gesture.ring && !gesture.pinky){
        playerChoice=8;
    }
    else if(gesture.thumb && gesture.index && gesture.middle && !gesture.ring && gesture.pinky){
        playerChoice=9;
    }
    else{
        playerChoice="INCORRECT GESTURE";
    }
}

function getComputerChoice(){
    return Math.floor(Math.random() * 9) + 1;
}

function roundCalc(playerChoice,computerChoice){
    if(typeof playerChoice !== "number" || typeof computerChoice !== "number"){
        return; // skip this frame, don't corrupt the score
    }
    if(currentBatter==="PLAYER"){
        batterScore+=playerChoice;
        }
    else if(currentBatter==="COMPUTER"){
        batterScore+=computerChoice
    }
    liveScore.textContent = batterScore;
    //i need to update points on the ui as well
    roundResultSet=true;
    if(target!=null){ //means game is in 2nd half
        if(playerChoice===computerChoice){
            roundResult="BOWLER WINS";
        }
        else if(batterScore>=target){
            roundResult="BATTER WINS";
        }     
        else{roundResult="PROCEED";}
    }
    else{
        if(playerChoice===computerChoice){
            roundResult="EQUAL";
        }
        else{roundResult="PROCEED";}
    }
}

function secondHalf(){

    target=batterScore;
    if(currentBatter==="COMPUTER"){currentBatter="PLAYER";}
    else{currentBatter="COMPUTER";}
    batterScore=0;

    moveCaptured=false;
    computersChoiceSelected=false;
    frameFrozen=false;
    roundResultSet=false;

    halfLabel.textContent = "2nd innings"; 
    targetLine.textContent = `Target: ${target};`
    batterLabel.textContent = (currentBatter === "PLAYER") ? "You" : "Computer";
    phaseStartTime=performance.now()
    gamePhase="countdown";
}
function detectHands(){
    const result=handLandmarker.detectForVideo(video,performance.now());
    let hand;

    //Keep clearing the canvas so that the next one draws on empty canvas
    if(gamePhase==="countdown"|| gamePhase==="waiting"|| gamePhase==="end"){
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    //Drawing the markings on the live feed
    if(result.landmarks.length){
        status.textContent=`Hand(s) detected: ${result.landmarks.length}`;
        hand=result.landmarks[0];

        // recogniseGesture(hand);
        // console.log(getFingerState(hand),playerChoice);

        const HAND_CONNECTIONS = [
                [0,1],[1,2],[2,3],[3,4],       // thumb
                [0,5],[5,6],[6,7],[7,8],       // index
                [5,9],[9,10],[10,11],[11,12],  // middle
                [9,13],[13,14],[14,15],[15,16],// ring
                [13,17],[17,18],[18,19],[19,20],// pinky
                [0,17]                          // palm base
                ];
        
        //Keep drawing the markings in countdown and waiting phase
        if(gamePhase==="countdown" || gamePhase=="waiting"){
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
        //freeze the fram with the markings in reveal phase
        else if(gamePhase==="reveal" && !frameFrozen){
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
            frameFrozen = true;
        }
    }
    else{
        status.textContent="No Hand Detected.";}
    
    //Logic for each gamephase
    if (gamePhase === "countdown") {
        computermove.textContent = "The computer is choosing...";
        usermove.textContent = "";
        roundResultDisplay.textContent = "";
        playerChoice = undefined;
        moveCaptured=false;

        let elapsed = performance.now() - phaseStartTime;
        if(elapsed<750){
            countdownelement.textContent="3";
            if(!computersChoiceSelected){
                computerChoice=getComputerChoice();
                computersChoiceSelected=true;
            }
        }
        else if(elapsed<1500){
            countdownelement.textContent="2";
        }
        else if(elapsed<2250){
            countdownelement.textContent="1";
        }
        else if(elapsed<3000){
            countdownelement.textContent="PLAY"
        }
        else{
            phaseStartTime=performance.now();
            gamePhase="reveal"; 
        }
    }
    else if (gamePhase === "reveal") {
        let elapsed = performance.now() - phaseStartTime;
        if(!moveCaptured){
            if(hand){
            recogniseGesture(hand);
            moveCaptured=true;
            }
        }
        if(!playerChoice){                        
            usermove.textContent="No hand detected. Please try again.";
            
            if(elapsed>1200){
            frameFrozen=false;
            computersChoiceSelected=false;
            phaseStartTime=performance.now();
            gamePhase="countdown";}
        }
        else if(playerChoice=="INCORRECT GESTURE"){
            usermove.textContent="Unidentified hand gesture. Please try again."; 
            frameFrozen=false;
            if(elapsed>1200){
                computersChoiceSelected=false;
                phaseStartTime=performance.now();
                gamePhase="countdown";}
        }
    
        else{
        usermove.textContent=`you played ${playerChoice}`;
        computermove.textContent=`the computer played ${computerChoice}`;
        if(elapsed>1000){
            phaseStartTime=performance.now();
            gamePhase="waiting";
            }
        }
    }
    else if (gamePhase === "waiting") {
        let elapsed=performance.now()-phaseStartTime;

        if(!roundResultSet){
            roundCalc(playerChoice,computerChoice);

            if(roundResult==="EQUAL" || roundResult==="PROCEED"){
                roundResultDisplay.textContent = `Ball played — running total: ${batterScore}`;
            }
            else if(roundResult==="BATTER WINS"){
                roundResultDisplay.textContent = `Target reached! Final score: ${batterScore}`;
            }
            else if(roundResult==="BOWLER WINS"){
                roundResultDisplay.textContent = `OUT! Final score: ${batterScore}`;
            }
        }

        if(elapsed>1500){
            if(roundResult==="EQUAL"){
                secondHalf();
            }
            else if(roundResult==="BATTER WINS" || roundResult==="BOWLER WINS"){
                gamePhase="end";
            }
            else{
                moveCaptured=false;
                computersChoiceSelected=false;
                roundResultSet=false;
                frameFrozen=false;
                computersChoiceSelected=false;
                phaseStartTime=performance.now();
                gamePhase="countdown";
            }
        }
    }
    else{
        console.log("REACHED END PHASE", playerScore, computerScore);
        usermove.textContent = "";
        computermove.textContent = "";
        roundResultDisplay.textContent = "";
        countdownelement.textContent = "GAME OVER";
        endPanel.style.display = "block";
        if(currentBatter=="PLAYER" && roundResult=="BATTER WINS"){
            finalScore.textContent = ` YOU WIN! Your score: ${batterScore}  Computer Score: ${target}`;
        }
        else if(currentBatter=="PLAYER" && roundResult=="BOWLER WINS"){
            finalScore.textContent = ` YOU LOSE:( Your score: ${batterScore}  Computer Score: ${target}`;
        }
        else if(currentBatter=="COMPUTER" && roundResult=="BOWLER WINS"){
            finalScore.textContent = ` YOU WIN! Your score: ${target}  Computer Score: ${batterScore}`;
        }
        else{
            finalScore.textContent = ` YOU LOSE:( Your score: ${target}  Computer Score: ${batterScore}`;
        }
       
        return
    }
    requestAnimationFrame(detectHands);
}

async function main(){
    await getCamera();
    await loadHandLandmarker();
    status.textContent="Ready";
    batFirstBtn.addEventListener("click", () => startMatch("PLAYER"));
    bowlFirstBtn.addEventListener("click", () => startMatch("COMPUTER"));
}

function startMatch(batter){
    currentBatter = batter;
    batterLabel.textContent = (batter === "PLAYER") ? "You" : "Computer";
    tossChoice.style.display = "none";
    gamePhase = "countdown";
    phaseStartTime = performance.now();
    detectHands();
}
main();
