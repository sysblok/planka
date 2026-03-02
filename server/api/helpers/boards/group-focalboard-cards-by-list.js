/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @description :: Groups Focalboard cards by their target Planka list.
 *                 Processes cards in cardOrder first, then remaining cards.
 */

module.exports = {
  sync: true,

  inputs: {
    focalboardCards: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard card blocks',
    },
    cardOrder: {
      type: 'ref',
      required: true,
      description: 'Array of card IDs in display order from Kanban view',
    },
    columnPropertyId: {
      type: 'string',
      required: true,
      description: 'Focalboard property ID used for column assignment',
    },
    listIdByOptionId: {
      type: 'ref',
      required: true,
      description: 'Map of Focalboard option ID to Planka list ID',
    },
    unorderedListId: {
      type: 'string',
      required: true,
      description: 'Planka list ID for cards without column assignment',
    },
    unorderedListName: {
      type: 'string',
      required: true,
      description: 'Name of the unordered list (for logging)',
    },
    columnOptions: {
      type: 'ref',
      required: true,
      description: 'Array of column property options (for logging)',
    },
  },

  fn(inputs) {
    const {
      focalboardCards,
      cardOrder,
      columnPropertyId,
      listIdByOptionId,
      unorderedListId,
      unorderedListName,
      columnOptions,
    } = inputs;

    console.log('');
    console.log('--- Grouping Cards by Column ---');
    console.log(`Cards in cardOrder: ${cardOrder.length}`);

    // Group cards by their column assignment
    const cardsByListId = {};

    // Initialize lists
    Object.values(listIdByOptionId).forEach((listId) => {
      cardsByListId[listId] = [];
    });
    cardsByListId[unorderedListId] = [];

    // Map Focalboard card IDs to card objects
    const focalboardCardById = {};
    focalboardCards.forEach((card) => {
      focalboardCardById[card.id] = card;
    });

    // Process cards in cardOrder first (maintains order)
    let processedFromCardOrder = 0;
    let cardsWithoutColumn = 0;
    const processedCardIds = new Set();

    cardOrder.forEach((cardId) => {
      const card = focalboardCardById[cardId];
      if (!card) return;

      processedCardIds.add(cardId);

      const columnValue = card.fields?.properties?.[columnPropertyId];
      const listId = listIdByOptionId[columnValue];

      if (listId) {
        cardsByListId[listId].push(card);
      } else {
        cardsByListId[unorderedListId].push(card);
        cardsWithoutColumn += 1;
      }

      processedFromCardOrder += 1;
    });

    console.log(`Cards processed from cardOrder: ${processedFromCardOrder}`);

    // Process cards not in cardOrder - place by column value, or Unordered if no column
    let cardsNotInCardOrder = 0;
    focalboardCards.forEach((card) => {
      if (!processedCardIds.has(card.id)) {
        const columnValue = card.fields?.properties?.[columnPropertyId];
        const listId = listIdByOptionId[columnValue];

        if (listId) {
          cardsByListId[listId].push(card);
        } else {
          cardsByListId[unorderedListId].push(card);
          cardsWithoutColumn += 1;
        }

        cardsNotInCardOrder += 1;
      }
    });

    console.log(`Cards not in cardOrder (added to "${unorderedListName}"): ${cardsNotInCardOrder}`);
    console.log(`Cards without column assignment: ${cardsWithoutColumn}`);

    return cardsByListId;
  },
};
