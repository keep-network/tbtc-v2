from random import random
from abc import ABC, abstractmethod

games = 3000
player1Prob = 0
while player1Prob <= -1:
    player2Prob = 0
    while player2Prob <= 1:
        p1Score = 0
        p2Score = 0
        i = 0
        while i < games:
            p2Choice = random() < player2Prob
            if random() < player1Prob:
                if p2Choice:
                    p1Score += 0
                    p2Score += 0
                else:
                    p1Score += -1
                    p2Score += 1
            elif p2Choice:
                p1Score += 1
                p2Score += -1
            else:
                p1Score += -4
                p2Score += -4
            i += 1
        print(f'p1 prob: {player1Prob} p1 score: {p1Score / games} p2 prob: {player2Prob} p2 score: {p2Score / games}')
        player2Prob += 0.05
    player1Prob += 0.05

agentCounter = 0
class Agent(ABC):
    def __init__(self):
        global agentCounter
        self.id = agentCounter
        agentCounter += 1
        self.type = 'default'
        super().__init__()

    def set_type(self, type):
        self.type = type

    @abstractmethod
    def actions(self):
        pass

    def act(self, cdf):
        actions = self.actions()
        num = random()
        i = 0
        while i < len(actions):
            prob = cdf[i]
            if num < prob:
                return actions[i]
            i += 1

    @abstractmethod
    def preference(self, outcome):
        pass

class ChickenAgent(Agent):
    def actions(self):
        return ['swerve', 'stay']

    def preference(self, outcome):
        otherAgentIndex = -1
        myIndex = -1
        if self.id == outcome[0][0].id:
            myIndex = 0
            otherAgentIndex = 1
        else:
            myIndex = 1
            otherAgentIndex = 0

        otherAgentAction = outcome[otherAgentIndex][1]
        myAction = outcome[myIndex][1]

        if myAction == 'swerve':
            if otherAgentAction == 'swerve':
                return 0
            else:
                return -1
        else:
            if otherAgentAction == 'swerve':
                return 1
            else:
                return -4


def generateProbabilties(numActions, resolution):
    if numActions == 1:
        return [[1]]
    else:
        pointers = []
        i = 0
        while i < numActions - 1:
            pointers.append(0)
            i += 1

        result = []
        while pointers[0] < 1:
            record = [pointers[0]]
            j = 1
            while j < len(pointers):
                record.append(record[-1] + pointers[j] - pointers[j-1])
                j += 1
            record.append(record[-1] + 1 - pointers[-1])
            result.append(record)

            indexToChange = len(pointers) - 1
            while indexToChange >= 0:
                if pointers[indexToChange] + resolution < 1:
                    break
                indexToChange -= 1

            pointers[indexToChange] += resolution
            resetIndex = indexToChange + 1
            while resetIndex < len(pointers):
                pointers[resetIndex] = pointers[indexToChange]
                resetIndex += 1
        return result

a = ChickenAgent()
b = ChickenAgent()

iterations = 3000
probabilities = generateProbabilties(len(a.actions()), 0.05)
valueMatrix = []
i = 0
while i < len(probabilities):
    j = 0
    inner = []
    while j < len(probabilities):
        inner.append([0, 0])
        j += 1
    valueMatrix.append(inner)
    i += 1

i = 0
while i < len(probabilities):
    j = 0
    while j < len(probabilities):
        aProb = probabilities[i]
        bProb = probabilities[j]
        count = 0
        while count < iterations:
            aAction = a.act(aProb)
            bAction = b.act(bProb)
            outcome = [[a, aAction], [b, bAction]]
            valueMatrix[i][j][0] += a.preference(outcome)
            valueMatrix[i][j][1] += b.preference(outcome)
            count += 1
        j += 1
    i += 1

i = 0
while i < len(probabilities):
    j = 0
    total = 0
    while j < len(probabilities):
        total += valueMatrix[i][j][0]
        j += 1
    print(f'value for {i}: {total}')
    i += 1
print(valueMatrix[0][0])

# visted = set([0, 0])
# choices = [0, 0]
# i = 0
# while i < len(choices):
    # originalChoice = choices.copy()
    # currentScore = valueMatrix[choices[0]][choices[1]][i]
    # j = 0
    # indexesToCheck = []
    # while j < len(probabilities):
        # temp = choices.copy()
        # temp[i] = j
        # indexesToCheck.append(temp)
        # j += 1
    # bestSoFar = currentScore
    # for choice in indexesToCheck:
        # temp = valueMatrix
        # for index in choice:
            # temp = temp[index]
        # temp = temp[i]
        # if temp > bestSoFar:
            # bestSoFar = temp
            # choices = choice
    # if originalChoice[i] == choices[i]:
        # i += 1
    # else:
        # i = 0
# print(choices)
