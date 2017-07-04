var CombatHandler = CombatHandler || (function() {
    'use strict';
    
    var bInCombat, bHasTakenAction, bHasTakenBonusAction, bIsWaitingOnRoll, bIsWaitingOnResponse, responseCallbackFunction,
    iMoveSpeedTotal, iMoveSpeedRemaining, iXStart, iYStart, iXCurrent, iYCurrent,
    currentPlayerDisplayName, currentTurnPlayer, currentTurnCharacter, currentTurnToken,
    currentlyCastingSpellRoll,
    target,
    direction,
    range,
    listTokensInEncounter = [],
    sPreviousAction, sPreviousBonusAction,
    listRollCallbackFunctions = [],
    listPlayerIDsWaitingOnRollFrom = [],
    defaults = {
            css: {
                button: {
                    'border': '1px solid #cccccc',
                    'border-radius': '1em',
                    'background-color': '#006dcc',
                    'margin': '0 .1em',
                    'font-weight': 'bold',
                    'padding': '.1em 1em',
                    'color': 'white'
                }
            }
        },
    templates = {};
    
    //**UTILITY SCRIPTS**
    var buildTemplates = function() {
        templates.cssProperty =_.template(
            '<%=name %>: <%=value %>;'
        );

        templates.style = _.template(
            'style="<%='+
                '_.map(css,function(v,k) {'+
                    'return templates.cssProperty({'+
                        'defaults: defaults,'+
                        'templates: templates,'+
                        'name:k,'+
                        'value:v'+
                    '});'+
                '}).join("")'+
            ' %>"'
        );
        
        templates.button = _.template(
            '<a <%= templates.style({'+
                'defaults: defaults,'+
                'templates: templates,'+
                'css: _.defaults(css,defaults.css.button)'+
                '}) %> href="<%= command %>"><%= label||"Button" %></a>'
        );
    },
    
    /*Makes the API buttons used throughout the script*/
    makeButton = function(command, label, backgroundColor, color){
        return templates.button({
            command: command,
            label: label,
            templates: templates,
            defaults: defaults,
            css: {
                color: color,
                'background-color': backgroundColor
            }
        });
    },
    
    promptButtonArray = function(promptName, listPromptableItems,listCommandNames){
        var stringToSend, 
            buttonArray = [];
            /*
        for(var i = 0; i < listPromptableItems.length; i++){
            var tempString = listPromptableItems[i];
            while(tempString.indexOf(' ') != -1){
                tempString = tempString.slice(0,tempString.indexOf(' ')) + tempString.slice(tempString.indexOf(' ') + 1);
            }
            tempString = tempString.toLowerCase();
            listCommandNames[i] = tempString;
            log(tempString);
        }
        */
        
        for(var i = 0; i < listPromptableItems.length; i++){
            buttonArray[i] = makeButton('!combat ' + listCommandNames[i], listPromptableItems[i], '#CDAE88', 'black');
        }
        stringToSend = '/w "' + currentPlayerDisplayName + '" '
            +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
            +'<div style="font-weight: bold; border-bottom: 1px solid black;font-size: 130%;">'
            +promptName
            +'</div>';
        for(var i = 0; i < buttonArray.length; i++){
            stringToSend += buttonArray[i];
        }
        stringToSend += '</div>';
        sendChat('BattleMaster', stringToSend);
    },

    promptLocation = function(xToAssign, yToAssign){
        
    },
    
    findCurrentTurnToken = function(turnorder) {
		if (!turnorder) 
			{turnorder = Campaign().get('turnorder');}
		if (!turnorder) 
			{return undefined;}
		if (typeof(turnorder) === 'string') 
			{turnorder = JSON.parse(turnorder);}
		if (turnorder && turnorder.length > 0 && turnorder[0].id !== -1)
			{return getObj('graphic',turnorder[0].id);}
		return;
	},
	
	findWhoIsControlling = function(character){
	  var whoIsControlling;
	  var listPlayerIDs;
	  _.each(character.get('controlledby').split(','), function(player){
	      
	      if(!playerIsGM(player)){
	          log('Player ID ' + player + ' is controlling this character!');
	          whoIsControlling = player;
	      }
	      else if(whoIsControlling === undefined){
	          log('Player ID ' + player + ' is a GM, setting them to controlling anyways!');
	          whoIsControlling = player;
	      }
	      else{
	          log('Player ID ' + player + ' is a GM, not controlling!');
	      }
	  });
	  return whoIsControlling;
	};
    
    var HandleInput = function(msg_orig){
        var msg = _.clone(msg_orig),
			args,
            attr,
            amount,
            chr,
            token,
            text='',
            totamount;
        if (msg.type !== 'api' && !bIsWaitingOnRoll){
                return;
        }
        if(bIsWaitingOnRoll && msg.inlinerolls != undefined){
            //Call roll result here
            log("We have recieved a roll result!")
            var playerIDLocation = listPlayerIDsWaitingOnRollFrom.indexOf(msg.playerid);
            if(playerIDLocation != -1){
                listRollCallbackFunctions[playerIDLocation](msg);
            }
            return;
        }
        args = msg.content.split(/\s+/);//splits the message contents into discrete arguments
		switch(args[0]) {
		    case '!combat':
		        switch(args[1]){
		            case 'start': StartCombat(); 
                    break;
		            case 'stop' : StopCombat(); 
                    break;
		            case 'test' : promptButtonArray('gm', ['Option 1','Option 2', 'Option 3']); 
                    break;
		            case 'weaponattack': WeaponAttack(getObj(msg.selected[0]._type, msg.selected[0]._id)); 
                    break;
		            case 'directspell': DirectSpellAttack(getObj(msg.selected[0]._type, msg.selected[0]._id)); 
                    break;
		            case 'move': 
                    break;
		            case 'aoespell': AOESpellAttack(); 
                    break;
                    case 'up': direction = args[1]; bIsWaitingOnResponse = false; responseCallbackFunction();
                    break;
                    case 'down': direction = args[1]; bIsWaitingOnResponse = false; responseCallbackFunction();
                    break;
                    case 'left': direction = args[1]; bIsWaitingOnResponse = false; responseCallbackFunction();
                    break;
                    case 'right': direction = args[1]; bIsWaitingOnResponse = false; responseCallbackFunction();
                    break;
                    case 'upright': direction = args[1]; bIsWaitingOnResponse = false; responseCallbackFunction();
                    break;
                    case 'downleft': direction = args[1]; bIsWaitingOnResponse = false; responseCallbackFunction();
                    break;
                    case 'upleft': direction = args[1]; bIsWaitingOnResponse = false; responseCallbackFunction();
                    break;
                    case 'downright': direction = args[1]; bIsWaitingOnResponse = false; responseCallbackFunction();
                    break;
		            //default: break;
		        }break;
		}
    },
    
    StartCombat = function(){
        bInCombat = true;
        bIsWaitingOnResponse = false;
        log('Combat Started!');
        sendChat("BattleMaster", "/w GM Combat Started!")
        /*
        Things this needs to do: 
        Set a combat bool to true
        Do all of our fun combat setup things
        */
    },
    
    StopCombat = function(){
        bInCombat = false;
        bIsWaitingOnResponse = false;
        log('Combat stopped!');
        sendChat("BattleMaster", "/w GM Combat Stopped!")
    },
    
    TurnChange = function(){
        log('The turn has changed!');
        var turnorder;
        //Find all the information on whose turn it is
        currentTurnToken = findCurrentTurnToken(Campaign().get('turnorder'));
        currentTurnCharacter = getObj('character',currentTurnToken.get('represents'));
        currentTurnPlayer = getObj('player',findWhoIsControlling(currentTurnCharacter));
        currentPlayerDisplayName = currentTurnPlayer.get('displayname');
        if (!turnorder) 
			{turnorder = Campaign().get('turnorder');}
		if (!turnorder) 
			{return undefined;}
		if (typeof(turnorder) === 'string') 
			{turnorder = JSON.parse(turnorder);}
        _.each(turnorder, function(current){
            listTokensInEncounter.push(getObj("graphic",current.id));
        });
        //Reset all the variables for the new turn
        ResetTokenTurnValues(currentTurnToken);
        ResetCharacterTurnValues(currentTurnCharacter);
        ResetUnspecificTurnValues();
        log('It\'s now ' + currentTurnCharacter.get('name') + '\'s turn!' );
        log('This character is controlled by player ' + currentTurnPlayer.get('displayname'))
        sendChat('BattleMaster','/w "'+ currentTurnPlayer.get('displayname') + '" It\'s your turn as ' + currentTurnCharacter.get('name'));
        promptButtonArray("Select an action", generateTurnOptions(),generateTurnOptionCommands());
    },
    
    ResetTokenTurnValues = function(currentTurnToken){
        iMoveSpeedTotal = currentTurnToken.get('bar1_max');
        iMoveSpeedRemaining = iMoveSpeedTotal;
        currentTurnToken.set('bar1_val', iMoveSpeedRemaining);
        iXStart = currentTurnToken.get('left');
        iYStart = currentTurnToken.get('top');
    },
    
    ResetCharacterTurnValues = function(currentTurnCharacter){
        
    },
    
    ResetUnspecificTurnValues = function(){
        bHasTakenAction = false;
        bHasTakenBonusAction = false;
        sPreviousAction = "";
        sPreviousBonusAction = "";
    },
    
    BuildMovementWalls = function(){
        
    },
    
    Move = function(){
        BuildMovementWalls();
        
    },
    
    WeaponAttack = function(targetToken){
        if(targetToken != undefined){
            log('Weapon attacking at ' + targetToken.get('name'));
            sendChat("BattleMaster", '/w "' + currentPlayerDisplayName + '" ' + "Now attempting to attack " + targetToken.get('name') + ". Please roll your weapon attack from your character sheet.");
            listRollCallbackFunctions.push(WeaponAttackRollCallback);
            listPlayerIDsWaitingOnRollFrom.push(currentTurnPlayer.id);
            bIsWaitingOnRoll = true;
            target = targetToken;
        }
        else{
            log('Tried to attack with weapon, but no target was selected!');
            sendChat("BattleMaster", '/w "' + currentPlayerDisplayName + '" No target is selected! Please select a target before you attempt to attack with a weapon!');
        }
    },
    
    WeaponAttackRollCallback = function(rollMsg){
        var loc = listPlayerIDsWaitingOnRollFrom.indexOf(rollMsg.playerid); //Find the index of this current roll callback in the list
        listPlayerIDsWaitingOnRollFrom.splice(loc,1); //Remove index from listPlayerIDsWaitingOnRollFrom
        listRollCallbackFunctions.splice(loc,1); //Remove index from listRollCallbackFunctions
        bIsWaitingOnRoll = (listPlayerIDsWaitingOnRollFrom.length != 0); //Check if we're still waiting on another roll
        var ac = getAttrByName(target.get('represents'),'npcd_ac');
        if(ac === "" || ac === undefined){
            log('Couldn\'t find npcd_ac, looking for just ac')
            ac = getAttrByName(target.get('represents'),'ac');
        }
        if(ac <= rollMsg.inlinerolls[0].results.total){
            log("Hit! Enemy AC is " + ac + " and roll result was " + rollMsg.inlinerolls[0].results.total);
            sendChat("BattleMaster", '/w "' + currentPlayerDisplayName + '" Hit! Applying damage to ' + target.get('name'));
            applyDamage(rollMsg.inlinerolls[2].results.total, 'none', target, getObj('character', target.get('represents')));
            if(rollMsg.inlinerolls[3].results.total != 0){
                applyDamage(rollMsg.inlinerolls[3].results.total, 'none', target, getObj('character', target.get('represents')));
            }
            spawnFx(target.get('left'), target.get('top'), 'glow-blood');
        }
        else{
            log("Miss! Enemy AC is " + ac + " and roll result was " + rollMsg.inlinerolls[0].results.total);
            sendChat("BattleMaster", '/w "' + currentPlayerDisplayName + '" Miss!');
        }
    },
    
    DirectSpellAttack = function(targetToken){
        if(targetToken != undefined){
            
        }
    },
    
    DirectSpellRollCallback = function(rollMsg){
        
    },
    
    AOESpellAttack = function(){
        sendChat('BattleMaster', '/w "' + currentPlayerDisplayName + '" Roll your AOE spell from your character sheet!');
        listPlayerIDsWaitingOnRollFrom.push(currentTurnPlayer.id);
        listRollCallbackFunctions.push(AOESpellRollCallback);
        bIsWaitingOnRoll = true;
    },
    
    AOESpellRollCallback = function(rollMsg){
        currentlyCastingSpellRoll = rollMsg;
        var rangeString = rollMsg.content.slice(rollMsg.content.indexOf("{{range=") + 8, rollMsg.content.indexOf("}} {{damage=")),
        x = currentTurnToken.get('left'), y = currentTurnToken.get('top'),
        args = rangeString.toLowerCase().split(/\s+/);
        if(args[0]!= "self"){
            log("Not self targeted!");
        }
        else{
            switch(args[1]){
                case "cone": promptButtonArray("Select a direction", ["North","South","East","West","Northeast","Northwest","Southeast","Southwest"], 
                ["up","down","right","left","upright","upleft","downright","downleft"]);
                bIsWaitingOnResponse = true;
                responseCallbackFunction = coneDirectionPromptCallback;
                range = args[2];
                log("Spell is a cone!");
                break;
                case "line": var direction; promptDirection(direction); break;
                case "sphere": break;
                case "cube": break;
                case "cylinder": break;
            }
        }
    },

    distanceBetween = function(originX, originY, finalX, finalY){
        var deltaX = originX - finalX,
        deltaY = originY - finalY
        return Math.sqrt(Math.pow(deltaX,2) + Math.pow(deltaY,2));
    },

    coneDirectionPromptCallback = function(){
        log("Casting " + direction);
        var xMod = 0, yMod = 0,
        x = currentTurnToken.get("left"), y = currentTurnToken.get("top");
        if(direction.toLowerCase().indexOf('up') != -1){
            yMod = -35;
        }
        else if(direction.toLowerCase().indexOf('down') != -1){
            yMod = 35;
        }
        if(direction.toLowerCase().indexOf('left') != -1){
            xMod = -35;
        }
        else if (direction.toLowerCase().indexOf('right') != -1){
            xMod = 35;
        }
        _.each(findAllTokensInCone(x + xMod, y + yMod, direction, range), spellEffects);
    },

    spellEffects = function(token){
        log("Found token " + token.get("name") + " in cone!");
        var playerID = findWhoIsControlling(getObj('character',token.get('represents')));
        log("Associated player: " + playerID);
        sendChat("BattleMaster", '/w "' + getObj('player',playerID).get("displayname") + '" Please roll a ' + currentlyCastingSpellRoll + ' saving throw for ' + token.get("name"));
        listPlayerIDsWaitingOnRollFrom.push(playerID);
        listRollCallbackFunctions.push(SavingThrowAgainstDamageRollCallback);
    },

    distanceToPixels = function(dist) {
	    var PIX_PER_UNIT = 70;
	    var page = getObj('page', Campaign().get('playerpageid'));
	    return PIX_PER_UNIT * (dist/page.get('scale_number'));
    },  
    
    findAllTokensInCone = function(originX, originY, direction, range){
        var listTokensToReturn = [],
        line1YofX, line2YofX,
        line1XofY, line2XofY,
        bLine1XNeg, bLine2XNeg,
        bLine1YNeg, bLine2YNeg;
        var tokenIsConstrainedByLines = function(token, line1XofY, line1YofX, line2XofY, line2YofX, bLine1XNeg, bLine1YNeg, bLine2XNeg, bLine2YNeg, range){
            var bValueToReturn, tokenX = token.get('left'), tokenY = token.get('top');
            bValueToReturn = (bLine1XNeg && tokenX <= line1XofY(tokenY) || (!bLine1XNeg) && tokenX >= line1XofY(tokenY));
            bValueToReturn = bValueToReturn && (bLine1YNeg && tokenY <= line1YofX(tokenX) || (!bLine1YNeg) && tokenY >= line1YofX(tokenX));
            bValueToReturn = bValueToReturn && (bLine2XNeg && tokenX <= line2XofY(tokenY) || (!bLine2XNeg) && tokenX >= line2XofY(tokenY));
            bValueToReturn = bValueToReturn && (bLine2YNeg && tokenY <= line2YofX(tokenX) || (!bLine2YNeg) && tokenY >= line2YofX(tokenX));
            bValueToReturn = bValueToReturn && (distanceBetween(originX, originY, tokenX, tokenY) <= distanceToPixels(range));
            return bValueToReturn;
        }
        switch (direction){
            case "up": 
                bLine1XNeg = false; bLine1YNeg = true;
                bLine2XNeg = true; bLine2YNeg = true;
                line1YofX = function(x){
                    return ((x - originX)*2) + originY;
                }
                line2YofX = function(x){
                    return -((x - originX)*2) + originY;
                }
                line1XofY = function(y){
                    return ((y - originY)/2) + originX;
                }
                line2XofY= function(y){
                    return -((y - originY)/2) + originX;
                }
            break;

            case "down": 
                bLine1XNeg = false; bLine1YNeg = false;
                bLine2XNeg = true; bLine2YNeg = false;
                line1YofX = function(x){
                    return -((x - originX)*2) + originY;
                }
                line2YofX = function(x){
                    return ((x - originX)*2) + originY;
                }
                line1XofY = function(y){
                    return -((y - originY)/2) + originX;
                }
                line2XofY= function(y){
                    return ((y - originY)/2) + originX;
                }
            break;

            case "left": 
                bLine1XNeg = true; bLine1YNeg = true;
                bLine2XNeg = true; bLine2YNeg = false;
                line1YofX = function(x){
                    return -((x - originX)/2) + originY;
                }
                line2YofX = function(x){
                    return ((x - originX)/2) + originY;
                }
                line1XofY = function(y){
                    return -((y - originY)*2) + originX;
                }
                line2XofY= function(y){
                    return ((y - originY)*2) + originX;
                }
            break;

            case "right": 
                bLine1XNeg = false; bLine1YNeg = false;
                bLine2XNeg = false; bLine2YNeg = true;
                line1YofX = function(x){
                    return -((x - originX)/2) + originY;
                }
                line2YofX = function(x){
                    return ((x - originX)/2) + originY;
                }
                line1XofY = function(y){
                    return -((y - originY)*2) + originX;
                }
                line2XofY= function(y){
                    return ((y - originY)*2) + originX;
                }
            break;

            case "upleft": 
                bLine1XNeg = false; bLine1YNeg = true;
                bLine2XNeg = true; bLine2YNeg = false;
                line1YofX = function(x){
                    return ((x - originX)/3) + originY;
                }
                line2YofX = function(x){
                    return ((x - originX)*3) + originY;
                }
                line1XofY = function(y){
                    return ((y - originY)*3) + originX;
                }
                line2XofY= function(y){
                    return ((y - originY)/3) + originX;
                }
            break;

            case "upright": 
                bLine1XNeg = false; bLine1YNeg = false;
                bLine2XNeg = true; bLine2YNeg = true;
                line1YofX = function(x){
                    return -((x - originX)*3) + originY;
                }
                line2YofX = function(x){
                    return -((x - originX)/3) + originY;
                }
                line1XofY = function(y){
                    return -((y - originY)/3) + originX;
                }
                line2XofY= function(y){
                    return -((y - originY)*3) + originX;
                }
            break;

            case "downleft": 
                bLine1XNeg = true; bLine1YNeg = true;
                bLine2XNeg = true; bLine2YNeg = false;
                line1YofX = function(x){
                    return -((x - originX)*3) + originY;
                }
                line2YofX = function(x){
                    return -((x - originX)/3) + originY;
                }
                line1XofY = function(y){
                    return -((y - originY)/3) + originX;
                }
                line2XofY= function(y){
                    return -((y - originY)*3) + originX;
                }
            break;

            case "downright": 
                bLine1XNeg = true; bLine1YNeg = false;
                bLine2XNeg = false; bLine2YNeg = true;
                line1YofX = function(x){
                    return ((x - originX)/3) + originY;
                }
                line2YofX = function(x){
                    return ((x - originX)*3) + originY;
                }
                line1XofY = function(y){
                    return ((y - originY)*3) + originX;
                }
                line2XofY= function(y){
                    return ((y - originY)/3) + originX;
                }
            break;
        }

        _.each(listTokensInEncounter, function(token){
            if(tokenIsConstrainedByLines(token, line1XofY, line1YofX, line2XofY, line2YofX, bLine1XNeg, bLine1YNeg, bLine2XNeg, bLine2YNeg, range)){
                listTokensToReturn.push(token);
                log(token.get("name") + " is within the cone!");
            }
        });
        return listTokensToReturn;
    },

    findAllTokensInSphere = function(x,y,range){

    },
    findAllTokensInLine = function(x,y,targetX,targetY,range){

    },
    findAllTokensInCube = function(x,y,range){

    },
    findAllTokensInCylinder = function(x,y,range,height){

    },
    
    SavingThrowAgainstDamageRollCallback = function(){
        var indexSaveAttr = rollMsg.content.indexOf("{{saveAttr="),
        indexSaveDesc = rollMsg.content.indexOf('}} {{savedesc='),
        indexSaveDc = rollMsg.content.indexOf('{{mod=DC'),
        rollAttribute = rollMsg.content.slice(indexSaveAttr + 11, indexSaveDesc),
        rollEffectsDesc = rollMsg.content.slice(indexSaveDesc + 14, rollMsg.content.indexOf('}} {{savedc= $[[')),
        rollDC = parseInt(rollMsg.content.slice(indexSaveDc + 8, rollMsg.content.indexOf('}} {{rname=')));

    },
    
    applyDamage = function(dmgAmt, dmgType, targetToken, targetCharacter){
        var immunitiesRaw = targetCharacter.get("npc_immunities"),
        resistancesRaw = targetCharacter.get("npc_resistances"),
        vulnerabilitiesRaw = targetCharacter.get("npc_vulnerabilities");
        if(immunitiesRaw != undefined && immunitiesRaw.toLowerCase().indexOf(dmgType.toLowerCase()) != -1){
            return;
        }
        else if(vulnerabilitiesRaw != undefined && vulnerabilitiesRaw.toLowerCase().indexOf(dmgType.toLowerCase()) != -1){
            targetToken.set('bar3_value', targetToken.get('bar3_value') - (2*dmgAmt));
            return;
        }
        else if(resistancesRaw != undefined && resistancesRaw.toLowerCase().indexOf(dmgType.toLowerCase()) != -1){
            targetToken.set('bar3_value', targetToken.get('bar3_value') - Math.floor(dmgAmt/2));
            return;
        }
        else{
            targetToken.set('bar3_value', targetToken.get('bar3_value') - dmgAmt);
            return;
        }
    },
    
    generateTurnOptions = function(){
        
        //Add class specific options as well!
        var optionsToReturn = [
            'Weapon Attack',
            'Direct Spell',
            'AOE Spell',
            'Move'
        ];
        return optionsToReturn;
    },

    generateTurnOptionCommands = function(){
        var optionsToReturn = [
            'weaponattack',
            'directspell',
            'aoespell',
            'move'
        ];
        return optionsToReturn;
    },
    
    RegisterEventHandlers = function(){
        buildTemplates();
        on('chat:message', HandleInput);
        on('change:campaign:turnorder', function(){
            if(bInCombat){
                TurnChange();
            }
        });
    };
    return {
        RegisterEventHandlers: RegisterEventHandlers,
    };
}());
on('ready',function(){
    'use strict';
    
    CombatHandler.RegisterEventHandlers();
})