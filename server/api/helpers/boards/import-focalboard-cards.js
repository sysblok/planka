/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');

/**
 * @description :: Creates Planka cards from grouped Focalboard card data.
 *                 Handles descriptions, due dates, label assignments, and custom field values.
 */

module.exports = {
  inputs: {
    boardId: {
      type: 'string',
      required: true,
      description: 'Planka board ID to create cards in',
    },
    cardsByListId: {
      type: 'ref',
      required: true,
      description: 'Map of Planka list ID to array of Focalboard cards',
    },
    textBlocks: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard text blocks (for descriptions)',
    },
    dueDatePropertyId: {
      type: 'string',
      allowNull: true,
      description: 'Focalboard property ID for due date (null if not found)',
    },
    labelPropertyId: {
      type: 'string',
      allowNull: true,
      description: 'Focalboard property ID for labels (null if not found)',
    },
    labelIdByFocalboardLabelId: {
      type: 'ref',
      required: true,
      description: 'Map of Focalboard label ID to Planka label ID',
    },
    listIdByOptionId: {
      type: 'ref',
      required: true,
      description: 'Map of Focalboard option ID to Planka list ID (for logging)',
    },
    columnOptions: {
      type: 'ref',
      required: true,
      description: 'Array of column property options (for logging)',
    },
    unorderedListName: {
      type: 'string',
      required: true,
      description: 'Name of the unordered list (for logging)',
    },
    assigneePropertyId: {
      type: 'string',
      allowNull: true,
      description: 'Focalboard property ID for assignees (maps to CardMembership)',
    },
    userMapping: {
      type: 'ref',
      description: 'Map of Focalboard user ID to Planka user ID',
    },
    customFieldGroup: {
      type: 'ref',
      description: 'Planka CustomFieldGroup for this board (null if no custom fields)',
    },
    customFieldIdByFocalboardPropertyId: {
      type: 'ref',
      description: 'Map of Focalboard property ID to Planka custom field ID',
    },
  },

  async fn(inputs) {
    const {
      boardId,
      cardsByListId,
      textBlocks,
      dueDatePropertyId,
      labelPropertyId,
      labelIdByFocalboardLabelId,
      listIdByOptionId,
      columnOptions,
      unorderedListName,
      assigneePropertyId,
      userMapping,
      customFieldGroup,
      customFieldIdByFocalboardPropertyId,
    } = inputs;

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

    const stats = {
      totalCardsImported: 0,
      cardsWithoutTitle: 0,
      cardsWithDescriptions: 0,
      cardsWithLabels: 0,
      cardsWithDueDate: 0,
      cardsWithMembers: 0,
      cardsWithCreator: 0,
      cardMembershipsCreated: 0,
      cardsWithCustomFields: 0,
      customFieldValuesCreated: 0,
    };

    // Mapping of Focalboard card ID to Planka card ID (for comments import)
    const cardIdMapping = {};

    const hasCustomFields = customFieldGroup && customFieldIdByFocalboardPropertyId &&
      Object.keys(customFieldIdByFocalboardPropertyId).length > 0;

    // Process each list
    for (const [listId, cards] of Object.entries(cardsByListId)) {
      if (cards.length === 0) continue;

      // Find list name for logging
      let listName = unorderedListName;
      for (const [optionId, id] of Object.entries(listIdByOptionId)) {
        if (id === listId) {
          const option = columnOptions.find((o) => o.id === optionId);
          listName = option?.value || 'Unknown';
          break;
        }
      }

      await Promise.all(
        cards.map(async (focalboardCard, index) => {
          // Build description from text blocks
          const cardTextBlocks = textBlocksByParentId[focalboardCard.id] || [];
          const descriptionParts = cardTextBlocks
            .map((block) => block.title?.trim())
            .filter((text) => text);

          const description = descriptionParts.length > 0 ? descriptionParts.join('\n\n') : null;

          if (description) {
            stats.cardsWithDescriptions += 1;
          }

          // Extract due date from Focalboard properties
          let dueDate = null;
          if (dueDatePropertyId) {
            const dueDateRaw = focalboardCard.fields?.properties?.[dueDatePropertyId];
            dueDate = sails.helpers.boards.parseFocalboardDate(dueDateRaw);

            if (dueDate) {
              stats.cardsWithDueDate += 1;
            }
          }

          const creatorPlankaId = userMapping[focalboardCard.createdBy];

          // Create card
          const cardValues = {
            boardId,
            listId,
            type: Card.Types.PROJECT,
            position: POSITION_GAP * (index + 1),
            name: focalboardCard.title?.trim() || 'Untitled',
            description,
            dueDate,
            isDueCompleted: dueDate ? false : null,
            listChangedAt: new Date(focalboardCard.updateAt).toISOString(),
            creatorUserId: creatorPlankaId || null,
          };

          if (!focalboardCard.title?.trim()) {
            stats.cardsWithoutTitle += 1;
          }

          const { id: cardId } = await Card.qm.createOne(cardValues);

          // Store mapping for comments import
          cardIdMapping[focalboardCard.id] = cardId;

          if (creatorPlankaId) {
            stats.cardsWithCreator++;
          };

          stats.totalCardsImported += 1;

          // Assign card members from assignee property
          if (assigneePropertyId && userMapping) {
            const assigneeValue = focalboardCard.fields?.properties?.[assigneePropertyId];

            if (assigneeValue) {
              const userIds = Array.isArray(assigneeValue) ? assigneeValue : [assigneeValue];
              let hasMembers = false;

              await Promise.all(
                userIds.map(async (fbUserId) => {
                  if (!fbUserId) return;

                  const plankaUserId = userMapping[fbUserId];

                  if (plankaUserId) {
                    await CardMembership.qm.createOne({
                      cardId,
                      userId: plankaUserId,
                    });
                    hasMembers = true;
                    stats.cardMembershipsCreated += 1;
                  }
                }),
              );

              if (hasMembers) {
                stats.cardsWithMembers += 1;
              }
            }
          }

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

              stats.cardsWithLabels += 1;
            }
          }

          // Create custom field values
          if (hasCustomFields) {
            let cardHasCustomFields = false;

            await Promise.all(
              Object.entries(customFieldIdByFocalboardPropertyId).map(
                async ([focalboardPropertyId, plankaCustomFieldId]) => {
                  const rawValue = focalboardCard.fields?.properties?.[focalboardPropertyId];

                  // Skip empty values
                  if (rawValue === null || rawValue === undefined || rawValue === '') {
                    return;
                  }

                  // Convert value to string (Planka stores all custom field values as strings)
                  const content = String(rawValue);

                  await CustomFieldValue.qm.createOrUpdateOne({
                    cardId,
                    customFieldGroupId: customFieldGroup.id,
                    customFieldId: plankaCustomFieldId,
                    content,
                  });

                  stats.customFieldValuesCreated += 1;
                  cardHasCustomFields = true;
                },
              ),
            );

            if (cardHasCustomFields) {
              stats.cardsWithCustomFields += 1;
            }
          }
        }),
      );

      console.log(`Created ${cards.length} cards in list "${listName}"`);
    }

    return { stats, cardIdMapping };
  },
};
