/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');

module.exports = {
  inputs: {
    board: {
      type: 'ref',
      required: true,
    },
    lists: {
      type: 'ref',
      required: true,
    },
    focalboardData: {
      type: 'json',
      required: true,
    },
  },

  async fn(inputs) {
    const {
      board: boardBlock,
      views,
      cards: focalboardCards,
      textBlocks,
      labels: focalboardLabels,
      labelPropertyId,
    } = inputs.focalboardData;

    console.log('');
    console.log('=== Starting Focalboard Import ===');
    console.log(`Board: ${boardBlock.title || 'Unknown'}`);
    console.log(`Total views: ${views.length}`);
    console.log(`Total cards: ${focalboardCards.length}`);
    console.log(`Total text blocks: ${textBlocks.length}`);
    console.log(`Total labels: ${focalboardLabels.length}`);

    // Find the Kanban view
    const kanbanView = views.find((view) => view.fields.viewType === 'board');
    if (!kanbanView) {
      throw new Error('No Kanban view found in Focalboard data');
    }

    console.log(`Using Kanban view: ${kanbanView.title}`);

    // Find the column property (the one used for grouping in Kanban view)
    const columnPropertyId = kanbanView.fields?.groupById;
    const columnProperty = boardBlock.cardProperties?.find((p) => p.id === columnPropertyId);

    if (!columnProperty) {
      throw new Error('Column property not found in Focalboard export');
    }
    console.log(`Column property: ${columnProperty.name} (${columnProperty.type})`);
    console.log(`Total column options: ${columnProperty.options.length}`);

    // =====================================================
    // LABELS SECTION
    // =====================================================

    console.log('');
    console.log('--- Creating Labels ---');

    const labelIdByFocalboardLabelId = {};

    if (focalboardLabels.length > 0) {
      await Promise.all(
        focalboardLabels.map(async (focalboardLabel, index) => {
          const plankaColor = sails.helpers.utils.convertFocalboardLabelColor(focalboardLabel.color);

          const { id } = await Label.qm.createOne({
            boardId: inputs.board.id,
            position: POSITION_GAP * (index + 1),
            name: focalboardLabel.value || null,
            color: plankaColor,
          });

          labelIdByFocalboardLabelId[focalboardLabel.id] = id;
          console.log(`Created label: "${focalboardLabel.value}" (${focalboardLabel.color} → ${plankaColor})`);
        }),
      );
    } else {
      console.log('No labels to import');
    }

    console.log(`Total labels created: ${Object.keys(labelIdByFocalboardLabelId).length}`);

    // =====================================================
    // LISTS SECTION
    // =====================================================
    console.log('');
    console.log('--- Creating Lists ---');
    const visibleOptionIds = kanbanView.fields?.visibleOptionIds || [];
    const listIdByOptionId = {};

    console.log(`Visible columns: ${visibleOptionIds.length}`);

    await Promise.all(
      visibleOptionIds.map(async (optionId, index) => {
        const option = columnProperty.options.find((opt) => opt.id === optionId);

        if (!option) {
          console.log(`  [${index}] Option not found: ${optionId}`);
          return;
        }

        const { id } = await List.qm.createOne({
          boardId: inputs.board.id,
          type: List.Types.ACTIVE,
          position: POSITION_GAP * (index + 1),
          name: option.value,
        });

        listIdByOptionId[optionId] = id;
        console.log(`  [${index}] Created list: "${option.value}" (position: ${POSITION_GAP * (index + 1)})`);
      })
    );

    console.log(`  ✓ Created ${Object.keys(listIdByOptionId).length} lists`);

    // Create an "Unordered" list for cards not in cardOrder or without column
    const unorderedListName = 'Unordered';
    const { id: unorderedListId } = await List.qm.createOne({
      boardId: inputs.board.id,
      type: List.Types.ACTIVE,
      position: POSITION_GAP * (visibleOptionIds.length + 1),
      name: unorderedListName,
    });
    console.log(`Created "${unorderedListName}" list (position: ${POSITION_GAP * (visibleOptionIds.length + 1)})`);

    // =====================================================
    // GROUP CARDS BY COLUMN
    // =====================================================
    console.log('');
    console.log('--- Grouping Cards by Column ---');

    // Build card order map
    const cardOrder = kanbanView.fields.cardOrder || [];
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

    console.log(`Cards processed from cardOrder: ${processedFromCardOrder }`);

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

    // Log carddistribution
    console.log('');
    console.log('Card distribution by list:');
    Object.entries(cardsByListId).forEach(([listId, cards]) => {
      // Find list name
      let listName = unorderedListName;
      for (const [optionId, id] of Object.entries(listIdByOptionId)) {
        if (id === listId) {
          const option = columnProperty.options?.find((o) => o.id === optionId);
          listName = option?.value || 'Unknown';
          break;
        }
      }
      console.log(`  ${listName}: ${cards.length} cards`);
    });

    // =====================================================
    // IMPORT CARDS
    // =====================================================
    console.log('');
    console.log('--- Importing Cards ---');

    // Build text block lookup by parent ID
    const textBlocksByParentId = {};
    textBlocks.forEach((block) => {
      if (!textBlocksByParentId[block.parentId]) {
        textBlocksByParentId[block.parentId] = [];
      }
      textBlocksByParentId[block.parentId].push(block);
    });


    let totalCardsImported = 0;
    let cardsWithoutTitle = 0;
    let cardsWithDescriptions = 0;
    let cardsWithLabels = 0;


    // Process each list
    for (const [listId, cards] of Object.entries(cardsByListId)) {
      if (cards.length === 0) continue;

      // Find list name for logging
      let listName = unorderedListName;
      for (const [optionId, id] of Object.entries(listIdByOptionId)) {
        if (id === listId) {
          const option = columnProperty.options?.find((o) => o.id === optionId);
          listName = option?.value || 'Unknown';
          break;
        }
      }

      console.log(`Processing list "${listName}"...`);

      await Promise.all(
        cards.map(async (focalboardCard, index) => {
          // Build description from text blocks
          const cardTextBlocks = textBlocksByParentId[focalboardCard.id] || [];
          const descriptionParts = cardTextBlocks
            .map((block) => block.title?.trim())
            .filter((text) => text);

          const description = descriptionParts.length > 0 ? descriptionParts.join('\n\n') : null;

          if (description) {
            cardsWithDescriptions += 1;
          }

          // Create card
          const cardValues = {
            boardId: inputs.board.id,
            listId,
            type: Card.Types.PROJECT,
            position: POSITION_GAP * (index + 1),
            name: focalboardCard.title?.trim() || 'Untitled',
            description,
            listChangedAt: new Date(focalboardCard.updateAt).toISOString(),
          };

          const { id: cardId } = await Card.qm.createOne(cardValues);
          totalCardsImported++;

          // Assign labels to card
          if (labelPropertyId) {
            const cardLabelIds = focalboardCard.fields?.properties?.[labelPropertyId];

            if (Array.isArray(cardLabelIds) && cardLabelIds.length > 0) {
              await Promise.all(
                cardLabelIds.map(async (focalboardLabelId) => {
                  const plankaLabelId = labelIdByFocalboardLabelId[focalboardLabelId];

                  if (plankaLabelId) {
                    await CardLabel.qm.createOne({
                      cardId,
                      labelId: plankaLabelId,
                    });
                  }
                }),
              );

              cardsWithLabels += 1;
            }
          }
        })
      );

      console.log(`Created ${cards.length} cards`);
    }

    console.log('');
    console.log('=== Import Complete ===');
    console.log(`Total cards imported: ${totalCardsImported}`);
    console.log(`Cards without title (named "Untitled"): ${cardsWithoutTitle}`);
    console.log(`Cards with descriptions: ${cardsWithDescriptions}`);
    console.log(`Cards with labels: ${cardsWithLabels}`);
    console.log(`Labels created: ${Object.keys(labelIdByFocalboardLabelId).length}`);
    console.log(`Lists created: ${Object.keys(listIdByOptionId).length + 1} (including "${unorderedListName}")`);
    console.log('');
  },
};
