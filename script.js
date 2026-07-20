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
const ctx = canvas.getContext("2d");

let handLandmarker;
let gamePhase,phaseStartTime;
let playerScore=0,computerScore=0,computerChoice,playerChoice;
let moveCaptured,computersChoiceSelected,roundResultSet;
let roundResult;
let frameFrozen;

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

function isExtended(hand,tipIndex,jointIndex){
    return hand[tipIndex].y<hand[jointIndex].y;
}

function getGesture(hand){ 
    const fingerState={
        thumb:isExtended(hand,4,2),
        index:isExtended(hand,8,6),
        middle:isExtended(hand,12,10),
        ring:isExtended(hand,16,14),
        pinky:isExtended(hand,20,18)
    };
    if (fingerState.index && fingerState.middle){
        if(fingerState.ring && fingerState.pinky){
            if(fingerState.thumb){
                return "PAPER";}
            else{return "UNIDENTIFIED GESTURE. PLEASE EXTEND ALL FIVE FINGERS IF YOU MEANT TO SHOW PAPER.";}
        }
        else{
            return "SCISSOR";
        }
    }
    else if(!fingerState.index && !fingerState.middle && !fingerState.ring && !fingerState.pinky){
        return "ROCK";
    }
    else{
        return "UNIDENTIFIED";
    }
}

function getComputerChoice(){
    const choices=["ROCK","PAPER","SCISSOR"];
    return choices[Math.floor(Math.random() * 3)];
}

function getRoundResult(player, computer) {
    const winCombinations = [["ROCK","SCISSOR"],["SCISSOR","PAPER"],["PAPER","ROCK"]];
    roundResultSet = true;

    if (player === computer) {
        roundResult = undefined;
    }
    else if (winCombinations.some(pair => pair[0] === player && pair[1] === computer)) {
        roundResult = true;
    }
    else {
        roundResult = false;
    }
}

function getPoints(roundoutcome){
    if(roundoutcome){
        playerScore++;
    }
    else{
        computerScore++;
    }
}


function detectHands(){
    const result=handLandmarker.detectForVideo(video,performance.now());
    //console.log(result)
    let hand;

    if(gamePhase==="countdown"|| gamePhase==="waiting"|| gamePhase==="end"){
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if(result.landmarks.length){
        status.textContent=`Hand(s) detected: ${result.landmarks.length}`;
        hand=result.landmarks[0];
        const HAND_CONNECTIONS = [
                [0,1],[1,2],[2,3],[3,4],       // thumb
                [0,5],[5,6],[6,7],[7,8],       // index
                [5,9],[9,10],[10,11],[11,12],  // middle
                [9,13],[13,14],[14,15],[15,16],// ring
                [13,17],[17,18],[18,19],[19,20],// pinky
                [0,17]                          // palm base
                ];
        if(gamePhase==="countdown"){
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
    else{status.textContent="No Hand Detected.";}
    
    if (gamePhase === "countdown") {
        moveCaptured=false;
        let elapsed = performance.now() - phaseStartTime;
        if(elapsed<750){
            countdownelement.textContent="ROCK";
            if(!computersChoiceSelected){
                computerChoice=getComputerChoice();
                computersChoiceSelected=true;
            }
        }
        else if(elapsed<1500){
            countdownelement.textContent="PAPER";
        }
        else if(elapsed<2250){
            countdownelement.textContent="SCISSORS";
        }
        else if(elapsed<2600){
            countdownelement.textContent="SHOOT"
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
            playerChoice=getGesture(hand);
            moveCaptured=true;
            }
        }
        if(!playerChoice){                        
            usermove.textContent="No hand detected. Please try again.";
            
            if(elapsed>800){
            frameFrozen=false;
            phaseStartTime=performance.now();
            gamePhase="countdown";}
        }
        else if(playerChoice==="UNIDENTIFIED"){
            usermove.textContent="Unidentified hand gesture. Please try again.";
            phaseStartTime=performance.now();
            frameFrozen=false;
            if(elapsed>800){
            gamePhase="countdown";}
        }
        else if(playerChoice.startsWith("UNIDENTIFIED")){
            usermove.textContent=`${playerChoice}`;
            phaseStartTime=performance.now();
            frameFrozen=false;
            if(elapsed>800){
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
            getRoundResult(playerChoice,computerChoice);
            if(roundResult!=undefined){
                getPoints(roundResult);
                playerPoints.textContent=`${playerScore}`;
                computerPoints.textContent=`${computerScore}`;
                }
            }
        if(elapsed>1000){
            if(roundResult===undefined){
                roundResultDisplay.textContent="It's a tie! No points added."
            }
            else if(roundResult){
                roundResultDisplay.textContent="You win! 1 point Added!";
            }
            else{
                 roundResultDisplay.textContent="You lose:( 1 point to the computer."
            }
        }

        if(elapsed>2300){        
            moveCaptured=false;
            computersChoiceSelected=false;
            roundResultSet=false;
            frameFrozen=false;
            phaseStartTime=performance.now()
            
            if(playerScore>=5 || computerScore>=5){
                gamePhase="end";
            }
            else{
                gamePhase="countdown";
            }
        }
    }
    else{
        console.log("REACHED END PHASE", playerScore, computerScore);
        
        if(playerScore>computerScore){
        finalResult.textContent=`Game Over! You won ${playerScore} - ${computerScore} against the computer!`;
        }
        else{
            finalResult.textContent=`Game Over! You lost ${playerScore} - ${computerScore} against the computer.`;
        }
        return
    }
    requestAnimationFrame(detectHands);
}

async function main(){
    await getCamera();
    await loadHandLandmarker();
    status.textContent="Ready";
    gamePhase="countdown";
    phaseStartTime=performance.now();
    detectHands();
}
main();
