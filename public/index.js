// entry point to script
function run() {
    canvas = document.getElementById('canvas'); // the html5 canvas
    ctx = canvas.getContext('2d');              // the rendering context
    lastTime = (new Date()).getTime();          // the last game loop time
    tickLength = 32            // Time in ms between rerenders
    map = null;                 // 2d char array representing game board
    mapSize = 5;                // the number of tiles 
    running = false;            // if the game is running
    dead = false;               // if the player is dead

    pCol = 0;                   // the col the player is in
    pRow = 0;                   // the row the player is in
    pd = 0;                     // the direction the player is facing 0:right,1:down,2:left,3:top
    numArrows = 1;              // number of arrows in inventory
    hasGold = false;            // if the player is holding gold
    pImg = new Image();         // image for the player
    pImg.src = "player.png";

    window.addEventListener('resize', resizeCanvas, false);
    document.onkeydown = handleKey; //call key handler function when key pressed

    resizeCanvas();
    gameLoop();
}

// randomly populate a map with given size
// one wumpus
// one gold
// pits placed with 20% probability
function createMap(size) {
    // initialize map and player's visited map as empty squares
    mapSize = size;
    map = Array(mapSize);
    tileKnowledge = Array(mapSize)
    for (i = 0; i < mapSize; i++) {
        map[i] = Array(mapSize);
        tileKnowledge[i] = Array(mapSize)
        for (j = 0; j < mapSize; j++) {
            map[i][j] = ' ';
            tileKnowledge[i][j] = new PerceptNode(new PCoord(i, j))
        }
    }
    // place gold
    coords = getRandomEmptyCoords();
    map[coords[0]][coords[1]] = 'g';

    // place wumpus
    coords = getRandomEmptyCoords();
    map[coords[0]][coords[1]] = 'w';

    // place pits
    for (i = 0; i < mapSize; i++) {
        for (j = 0; j < mapSize; j++) {
            if (Math.random() < 0.2 && isEmpty(i, j)) {
                map[i][j] = 'p';
            }
        }
    }

    // reset variables for new game
    pCol = 0;
    pRow = 0;
    pd = 0;
    running = true;
    dead = false;
    hasGold = false;
    numArrows = 1;

    // reset inventory and location information
    resizeCanvas();
    updateInventory();
    checkLocation();
}

// Kills the AI
function haltAI() {
    console.log("Terminating AI")
    running = false
}


async function runCautiousAI() {
    console.log("starting AI!")
    gameScore = 0
    while (running) {
        gameLoop()
        turnComplete = false;
        // Store some of the the percept for this tile. 
        // We won't use our current percept object, but we will use the knowledge later
        tileKnowledge[pRow][pCol].nearWumpus = nearWumpus()
        tileKnowledge[pRow][pCol].nearPit = nearPit()
        tileKnowledge[pRow][pCol].timesVisited += 1
        console.log(tileKnowledge[pRow][pCol].timesVisited)
        // Turn until we aren't facing a wall
        while (isFacingWall()) {
            if (Math.random() <= .5) {
                move(1)
            } else {
                move(2)
            }
        }
        // If we have gold, return home
        if (hasGold && !turnComplete) {
            while (pCol != 0 || pRow != 0) {
                moveComplete = false
                if (isValid(pRow - 1, pCol) && !moveComplete) {
                    if (map[pRow - 1][pCol] == 'v') {
                        while (pd != 3) {
                            move(1)
                        }
                        gameScore--
                        move(0)
                        moveComplete = true
                    } else if (!nearPit || !nearWumpus) {
                        gameScore--
                        move(0)
                        moveComplete = true
                    }
                }
                if (isValid(pRow, pCol - 1) && !moveComplete) {
                    if (map[pRow][pCol - 1] == 'v') {
                        while (pd != 2) {
                            move(1)
                        }
                        gameScore--
                        move(0)
                        moveComplete = true
                    }
                } else if (!nearPit || !nearWumpus) {
                    gameScore--
                    move(0)
                    moveComplete = true
                }
                if (isValid(pRow + 1, pCol) && !moveComplete) {
                    if (map[pRow + 1][pCol] == 'v') {
                        while (pd != 1) {
                            move(1)
                        }
                        gameScore--
                        move(0)
                        moveComplete = true
                    }
                }
                if (isValid(pRow, pCol + 1) && !moveComplete) {
                    if (map[pRow][pCol + 1] == 'v') {
                        while (pd != 0) {
                            move(1)
                        }
                        gameScore--
                        move(0)
                        moveComplete = true
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 200));
                gameLoop()
            }
            turnComplete = true
        }
        // If we are standing on gold, pick it up
        if (nearGold() && !turnComplete) {
            gameScore += 1000
            move(3)
            turnComplete = true
        }
        // If we are totally surrounded by visited tiles
        if (surroundedByVisited() && !turnComplete) {
            rand = Math.random()
            if (rand <= .05) {
                move(1)
            } else if (rand <= .10) {
                move(2)
            } else {
                gameScore--
                move(0)
            }
            turnComplete = true
        }
        // If we have visited the tile we are facing, turn, unless we feel a breeze or smell the wumpus, then leave
        if (isFacingVisitedSquare() && !turnComplete) {
            if ((nearPit() || nearWumpus())) {
                gameScore--
                move(0)
                turnComplete = true
            } else {
                move(1)
                while (isFacingWall()) {
                    move(1)
                }
            }
        }
        else if (!turnComplete) {
            if (nearPit() || nearWumpus() && !turnComplete && tileKnowledge[pRow][pCol].timesVisited < 5) {
                move(1)
                while (isFacingWall()) {
                    move(1)
                }
            } else {
                gameScore--
                move(0)
                turnComplete = true
            }
        }
        if (!turnComplete && tileKnowledge[pRow][pCol].timesVisited >= 5) {
            gameScore--
            move(0)
        }
        // Sleep for 200ms for rendering purposes
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.warn(gameScore)
}



// Starts the AI
async function runSmartAI() {
    console.log("starting AI!")
    gameScore = 0
    while (running) {
        turnComplete = false;

        // update this tile's percept 
        tileKnowledge[pRow][pCol].nearWumpus = await nearWumpus()
        tileKnowledge[pRow][pCol].nearPit = await nearPit()
        tileKnowledge[pRow][pCol].visited = true

        // Run a pass over the whole map's percepts to do some learning, return the edgePercepts
        edgeNodes = await calculatePercepts()



        // If we have gold, return home
        if (hasGold && !turnComplete) {
            await navToCoords(0, 0)
            turnComplete = true
        }

        // If we are standing on gold, pick it up
        if (nearGold() && !turnComplete) {
            gameScore += 1000
            move(3)
            turnComplete = true
        }

        if (!turnComplete) {
            safestEdgeNode = edgeNodes.shift()
            console.log("navigating to C%dxR%d", safestEdgeNode.coord.col, safestEdgeNode.coord.row)
            await navToCoords(safestEdgeNode.coord.row, safestEdgeNode.coord.col)
            turnComplete = true
        }

        if (!turnComplete) {
            console.error("Empty Turn! No move was made")
        }
        gameLoop()

        // Sleep for tickLength for rendering purposes
        await new Promise(resolve => setTimeout(resolve, tickLength));

    }
    console.warn(gameScore)
}


async function navToCoords(row, col) {
    route = await bfs(row, col)

    for (k = 0; k < route.length; k++) {
        nextCoords = route[k]

        if (pCol == col && pRow == row || !running) {
            break
        }

        while (!isFacingCoords(nextCoords.row, nextCoords.col) && running) {
            await move(1)
        }
        if (isFacingCoords(nextCoords.row, nextCoords.col) && running) {
            gameScore--
            await move(0)
        }
        await gameLoop()
        await new Promise(resolve => setTimeout(resolve, tickLength));
    }
}

// return coordinates of an empty square
function getRandomEmptyCoords() {
    do {
        row = Math.floor(Math.random() * mapSize);
        col = Math.floor(Math.random() * mapSize);
    }
    while (!isEmpty(row, col));

    return [row, col];
}


function calculatePercepts() {
    currentEdgeNodes = Array()

    for (i = 0; i < mapSize; i++) {
        for (j = 0; j < mapSize; j++) {
            curTile = tileKnowledge[i][j]
            curTile.probabilityPit = 0
            curTile.probabilityWumpus = 0

            if (map[i][j] == 'v') {
                curTile.isEdgeNode = false
                curTile.probabilityPit = -1
                curTile.probabilityWumpus = -1
                continue
            }
            // Down
            if (isValid(i + 1, j)) {
                downPercept = tileKnowledge[i + 1][j]
                if (!downPercept.visited) {
                    curTile.probabilityPit += .10
                    curTile.probabilityWumpus += .10
                } else {
                    curTile.isEdgeNode = true
                    if (downPercept.nearPit) {
                        curTile.probabilityPit += .50
                    }
                    if (downPercept.nearWumpus) {
                        curTile.probabilityWumpus += .50
                    }
                }
            } else {
                curTile.probabilityPit += .10
                curTile.probabilityWumpus += .10
            }
            // Up
            if (isValid(i - 1, j)) {
                upPercept = tileKnowledge[i - 1][j]
                if (!upPercept.visited) {
                    curTile.probabilityPit += .10
                    curTile.probabilityWumpus += .10
                } else {
                    curTile.isEdgeNode = true
                    if (upPercept.nearPit) {
                        curTile.probabilityPit += .50
                    }
                    if (upPercept.nearWumpus) {
                        curTile.probabilityWumpus += .50
                    }
                }
            } else {
                curTile.probabilityPit += .10
                curTile.probabilityWumpus += .10
            }
            // Right
            if (isValid(i, j + 1)) {
                rightPercept = tileKnowledge[i][j + 1]
                if (!rightPercept.visited) {
                    curTile.probabilityPit += .10
                    curTile.probabilityWumpus += .10
                } else {
                    curTile.isEdgeNode = true
                    if (rightPercept.nearPit) {
                        curTile.probabilityPit += .50
                    }
                    if (rightPercept.nearWumpus) {
                        curTile.probabilityWumpus += .50
                    }
                }

            } else {
                curTile.probabilityPit += .10
                curTile.probabilityWumpus += .10
            }

            // Left
            if (isValid(i, j - 1)) {
                leftPercept = tileKnowledge[i][j - 1]
                if (!leftPercept.visited) {
                    curTile.probabilityPit += .10
                    curTile.probabilityWumpus += .10
                } else {
                    curTile.isEdgeNode = true

                    if (leftPercept.nearPit) {
                        curTile.probabilityPit += .50
                    }
                    if (leftPercept.nearWumpus) {
                        curTile.probabilityWumpus += .50
                    }
                }
            } else {
                curTile.probabilityPit += .10
                curTile.probabilityWumpus += .10
            }
            tileKnowledge[i][j] = curTile
        }
        currentEdgeNodes = currentEdgeNodes.concat(tileKnowledge[i].filter(tile => tile.isEdgeNode === true))
    }
    currentEdgeNodes.sort(function (a, b) { return (a.probabilityPit + a.probabilityWumpus) - (b.probabilityPit + b.probabilityWumpus) })

    return currentEdgeNodes
}


//  Breadth first search, to find a route to coords. Based off of example algorithm from BFS Wikipedia page
function bfs(rowToFind, colToFind) {

    open_set = Array()

    // an empty set to maintain visited nodes
    closed_set = Array()

    // a dictionary to maintain meta information(used for path formation)
    // key -> (parent state, action to reach child)
    meta = {}

    // initialize
    root = new PCoord(pRow, pCol)
    meta[root] = new SpecItem(null, null)
    open_set.push(root)

    // For each node on the current level expand and process, if no children
    // (leaf) then unwind
    while (open_set.length > 0) {
        subtree_root = open_set.shift()

        // We found the node we wanted so stop and emit a path.
        if (subtree_root.row == rowToFind && subtree_root.col == colToFind) {
            // meta[subtree_root] = new SpecItem(subtree_root, "0") //create metadata for these nodes
            return construct_path(subtree_root, meta)
        }

        neighbors = getNeighborCoords(subtree_root, (rowToFind == 0 && colToFind == 0))
        // For each child of the current tree process
        for (i = 0; i < neighbors.length; i++) {

            // The node has already been processed, so skip over it
            if (closed_set.filter(node => node.row == neighbors[i].row && node.col == neighbors[i].col).length > 0) {
                continue
            }

            // The neighbors[i] is not enqueued to be processed, so enqueue this level of
            // neighbors[i]ren to be expanded
            if (open_set.filter(node => node.row == neighbors[i].row && node.col == neighbors[i].col).length == 0) {
                meta[neighbors[i]] = new SpecItem(subtree_root, neighbors[i]) //create metadata for these nodes
                open_set.push(neighbors[i]) // enqueue these nodes
            }
        }
    }
    // We finished processing the root of this subtree, so add it to the closed
    // set
    closed_set.push(subtree_root)
}

// Produce a backtrace of the actions taken to find the goal node, using the
// recorded meta dictionary
function construct_path(state, meta) {
    action_list = Array()
    // Continue until you reach root meta data(i.e. (None, None))
    while (meta[state] != null) {
        action = meta[state].action
        action_list.push(action)
        state = meta[state].parent_state
    }
    action_list.reverse()

    action_list.shift()
    return action_list
}


function getNeighborCoords(pcCenter, onlyVisited) {
    neighbors = []
    if (isValid(pcCenter.row, pcCenter.col + 1)) {
        if (map[pcCenter.row][pcCenter.col + 1] == 'v') {
            neighbors.push(new PCoord(pcCenter.row, pcCenter.col + 1))
        } else if (!onlyVisited) {
            neighbors.push(new PCoord(pcCenter.row, pcCenter.col + 1))
        }
    }
    if (isValid(pcCenter.row, pcCenter.col - 1)) {
        if (map[pcCenter.row][pcCenter.col - 1] == 'v') {
            neighbors.push(new PCoord(pcCenter.row, pcCenter.col - 1))
        } else if (!onlyVisited) {
            neighbors.push(new PCoord(pcCenter.row, pcCenter.col - 1))
        }
    }
    if (isValid(pcCenter.row + 1, pcCenter.col)) {
        if (map[pcCenter.row + 1][pcCenter.col] == 'v') {
            neighbors.push(new PCoord(pcCenter.row + 1, pcCenter.col))
        } else if (!onlyVisited) {
            neighbors.push(new PCoord(pcCenter.row + 1, pcCenter.col))
        }
    }
    if (isValid(pcCenter.row - 1, pcCenter.col)) {
        if (map[pcCenter.row - 1][pcCenter.col] == 'v') {
            neighbors.push(new PCoord(pcCenter.row - 1, pcCenter.col))
        } else if (!onlyVisited) {
            neighbors.push(new PCoord(pcCenter.row - 1, pcCenter.col))
        }
    }
    return neighbors
}




// handle keyboard input
function handleKey(e) {
    // i don't remember which numbers corespond to which key
    if (e.keyCode == '38') {
        move(0);
    }
    else if (e.keyCode == '37') {
        move(1);
    }
    else if (e.keyCode == '39') {
        move(2);
    }
    else if (e.keyCode == '40') {
        move(3);
    }
    else if (e.keyCode == '16') {
        move(4);
    }
    gameLoop()
    calculatePercepts()
}


function move(num) {
    // only allow move if the game is running
    if (!running) {
        return;
    }

    // move forward
    if (num == 0) {
        moved = false;
        // move according to the player direction
        if (pd == 0 && pCol < mapSize - 1) {
            pCol += 1;
            moved = true;
        }
        else if (pd == 1 && pRow < mapSize - 1) {
            pRow += 1;
            moved = true;
        }
        else if (pd == 2 && pCol > 0) {
            pCol -= 1;
            moved = true;
        }
        else if (pd == 3 && pRow > 0) {
            pRow -= 1;
            moved = true;
        }
    }
    // turn left
    else if (num == 1) {
        pd -= 1;
        if (pd < 0) {
            pd = 3
        }
    }
    // turn right
    else if (num == 2) {
        pd += 1;
        if (pd > 3) {
            pd = 0;

        }
    }
    // pick up
    else if (num == 3) {
        if (map[pRow][pCol] == 'g') {
            map[pRow][pCol] = ' ';
            hasGold = true;
        }
    }
    // shoot
    else if (num == 4) {
        shoot();
    }

    checkLocation();
    updateInventory();
}

function shoot() {
    // check if there is an arrow to shoot
    if (numArrows <= 0) {
        return;
    }
    // shoot right
    if (pd == 0) {
        for (i = pCol; i < mapSize; i++) {
            if (map[pRow][i] == "w") {
                map[pRow][i] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // shoot down
    else if (pd == 1) {
        for (i = pRow; i < mapSize; i++) {
            if (map[i][pCol] == "w") {
                map[i][pCol] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // shoot left
    else if (pd == 2) {
        for (i = pCol; i >= 0; i--) {
            if (map[pRow][i] == "w") {
                map[pRow][i] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // shoot up
    else {
        for (i = pRow; i >= 0; i--) {
            if (map[i][pCol] == "w") {
                map[i][pCol] = " ";
                console.log("You killed the Wumpus!");
            }
        }
    }
    // decrement number of arrows
    numArrows -= 1;
}




// update the arrows and gold in inventory
function updateInventory() {
    var node = document.getElementById("items");
    // set number of arrows
    node.innerText = "Arrows x";
    node.innerText += numArrows;
    // set if player is holding gold
    if (hasGold) {
        node.innerText += ",    Gold";
    }
}

// notify player about what is nearby, and update the map
function checkLocation() {
    list = document.getElementById("infoList");
    list.innerHTML = '';

    // check if player is on wumpus
    if (map[pRow][pCol] == 'w') {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You were eaten by the Wumpus!"));
        list.appendChild(entry);

        running = false;
    }
    // check if player is on pit
    if (map[pRow][pCol] == 'p') {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You fell into a pit!"));
        list.appendChild(entry);
        running = false;
    }
    // check if the player died from wumpus or pit
    if (!running) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You lose!"));
        list.appendChild(entry);
        died = true;
        gameLoop()
        return;
    }

    // set current tile to visited
    if (map[pRow][pCol] == " " || map[pRow][pCol] == "h") {
        map[pRow][pCol] = "v";
    }

    // the player wins if they have gold and
    // are on the top left square
    if (pRow == 0 && pCol == 0 && hasGold) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You win!"));
        list.appendChild(entry);
        running = false;
        return;
    }

    // notify if wumpus is in 4 surrounding squares
    if (nearWumpus()) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You smell a stench."));
        list.appendChild(entry);
    }
    // notify if pit is in 4 surrounding squares
    if (nearPit()) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You feel a breeze."));
        list.appendChild(entry);
    }
    // notify if gold is in current square
    if (nearGold()) {
        entry = document.createElement("li");
        entry.appendChild(document.createTextNode("You see a glitter."));
        list.appendChild(entry);
    }
}

// get the char values of the 4 adjacent squares
function getNeighborValues(row, col) {
    neighborValues = [];
    neighbors = [[row - 1, col], [row + 1, col],
    [row, col - 1], [row, col + 1]];
    for (i = 0; i < neighbors.length; i++) {
        n = neighbors[i];
        if (isValid(n[0], n[1])) {
            neighborValues.push(map[n[0]][n[1]]);
        }
    }
    return neighborValues;
}

///////////////////////////
// Player Helper Functions
///////////////////////////
// check if the player is near the wumpus
function nearWumpus() {
    return getNeighborValues(pRow, pCol).includes("w");
}

// check if the player is near a pit
function nearPit() {
    return getNeighborValues(pRow, pCol).includes("p");
}

// check if the player is on the gold square
function nearGold() {
    return map[pRow][pCol] == "g";
}

// checxk if the player is surrounded by visited tiles
function surroundedByVisited() {
    return getNeighborValues(pRow, pCol).every(v => v == "v");
}

function isFacingCoords(row, col) {
    if (pd == 0 && (pCol + 1) == col) {
        return true;
    }
    // Facing down
    else if (pd == 1 && (pRow + 1) == row) {
        return true;
    }
    // Facing left
    else if (pd == 2 && (pCol - 1) == col) {
        return true;
    }
    // Facing up
    else if (pd == 3 && (pRow - 1) == row) {
        return true;
    }
    return false
}

function isFacingWall() {
    // Facing right
    if (pd == 0 && pCol < mapSize - 1) {
        return false;
    }
    // Facing left
    else if (pd == 1 && pRow < mapSize - 1) {
        return false;
    }
    // Facing down
    else if (pd == 2 && pCol > 0) {
        return false;
    }
    // Facing up
    else if (pd == 3 && pRow > 0) {
        return false;

    }
    return true;
}

function isFacingVisitedSquare() {
    // Facing right
    if (pd == 0 && (pCol + 1) < mapSize) {
        if (map[pRow][pCol + 1] == 'v') {
            return true;
        }
    }
    // Facing down
    else if (pd == 1 && (pRow + 1) < mapSize) {
        if (map[pRow + 1][pCol] == 'v') {
            return true;
        }
    }
    // Facing left
    else if (pd == 2 && (pCol - 1) > -1) {
        if (map[pRow][pCol - 1] == 'v') {
            return true;
        }
    }
    // Facing up
    else if (pd == 3 && (pRow - 1) > -1) {
        if (map[pRow - 1][pCol] == 'v') {
            return true;
        }
    }
    return false;
}

// if a square is empty
function isEmpty(row, col) {
    return !(row == 0 && col == 0) && map[row][col] == ' ';
}

// if a square is in the map
function isValid(row, col) {
    return row >= 0 && row < mapSize && col >= 0 && col < mapSize;
}


//////////////
// Rendering Logic
//////////////

// animate
function gameLoop() {

    currentTime = (new Date()).getTime();
    delta = (currentTime - lastTime);
    // console.log(delta)

    if (delta > 70 || !running) {
        draw();
        window.requestAnimationFrame(gameLoop);
        lastTime = currentTime;

    }



}

// draw game board on canvas
function draw() {
    // clear canvas
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // draw map if created
    if (map) {
        for (row = 0; row < mapSize; row++) {
            for (col = 0; col < mapSize; col++) {
                char = map[row][col];

                if (char == " " || char == "v") {
                    // draw visited squares
                    if (char == "v") {
                        ctx.fillStyle = "#ADD8E6";
                    }
                    //draw unvisited squares
                    else {
                        ctx.fillStyle = "gray";
                    }
                }
                // draw wumpus
                else if (char == "w") {
                    ctx.fillStyle = "red";
                }
                // draw gold
                else if (char == "g") {
                    ctx.fillStyle = "yellow";
                }
                // draw pit
                else if (char == "p") {
                    ctx.fillStyle = "black";
                }
                // draw rectangle with specific color
                ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);

                // draw square border
                ctx.strokeStyle = 'black';
                ctx.strokeRect(col * tileSize, row * tileSize, tileSize, tileSize);

                // Draw Percept overlay
                percept = tileKnowledge[row][col]

                ctx.font = tileSize / 3.5 + "px Arial";

                ctx.fillStyle = 'orange';
                ctx.fillText(percept.probabilityWumpus.toPrecision(3), col * tileSize, row * tileSize + tileSize - (tileSize / 4.5));
                ctx.fillStyle = 'lightGreen';
                ctx.fillText(percept.probabilityPit.toPrecision(3), col * tileSize, row * tileSize + tileSize);
            }
        }
        // draw player image with correct rotation
        ctx.translate(pCol * tileSize + tileSize / 2, pRow * tileSize + tileSize / 2);
        ctx.rotate(pd / 2 * Math.PI);
        ctx.drawImage(pImg, -tileSize / 2 * 0.9, -tileSize / 2 * 0.9, tileSize * 0.9, tileSize * 0.9);
        ctx.rotate(-pd / 2 * Math.PI);
        ctx.translate(-(pCol * tileSize + tileSize / 2), -(pRow * tileSize + tileSize / 2));
    }
    // otherwise draw prompt to create a map
    else {
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Press a Button to Create a Map!", canvasSize / 2, canvasSize / 2);
    }
}

// resize canvas and update tileSize when window size changes
function resizeCanvas() {
    canvasSize = Math.min(wrapper.offsetWidth - 20, wrapper.offsetHeight - 300);
    tileSize = canvasSize / mapSize;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    draw();
}


class SpecItem {
    constructor(parent_state, action) {
        this.parent_state = parent_state
        this.action = action
    }
}



class PCoord {
    constructor(row, col) {
        this.row = row;
        this.col = col;
        // Keeps the use of this in dictionaries unique
        this.keyVal = Math.random() + Math.random() + row + col
    }
}

PCoord.prototype.toString = function () {
    return "" + this.keyVal + "";
};


class PerceptNode {
    constructor(coord) {
        this.coord = coord
        this.timesVisited = 0
        this.probabilityPit = 0
        this.probabilityWumpus = 0
        this.nearPit = false
        this.nearWumpus = false
        this.visited = false
        this.isEdgeNode = false
    }

}