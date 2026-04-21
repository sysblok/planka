/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');

/**
 * @description :: Creates Planka cards from grouped Focalboard card data.
 *                 Handles descriptions, due dates, label assignments, custom field values,
 *                 and CREATE_CARD action records with original Focalboard timestamps.
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
    listById: {
      type: 'ref',
      required: true,
      description: 'Map of Planka list ID to full list object',
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
    actorUser: {
      type: 'ref',
      required: true,
      description: 'The user who triggered the import (fallback for action userId)',
    },
    customFieldGroup: {
      type: 'ref',
      description: 'Planka CustomFieldGroup for this board (null if no custom fields)',
    },
    customFieldIdByFocalboardPropertyId: {
      type: 'ref',
      description: 'Map of Focalboard property ID to Planka custom field ID',
    },
    focalboardUrlFieldId: {
      type: 'ref',
      description: 'Planka custom field ID for the Focalboard URL field (null if not requested)',
    },
    focalboardViewId: {
      type: 'string',
      description: 'Focalboard view ID used to construct card URLs',
    },
    focalboardBaseUrl: {
      type: 'string',
      description: 'Base URL of the Focalboard instance',
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
      listById,
      assigneePropertyId,
      userMapping,
      actorUser,
      customFieldGroup,
      customFieldIdByFocalboardPropertyId,
      focalboardUrlFieldId,
      focalboardViewId,
      focalboardBaseUrl,
    } = inputs;

    console.log('');
    console.log('--- Importing Cards ---');

    console.log(`Focalboard URL field ID: ${focalboardUrlFieldId}`);
    console.log(`Focalboard view ID: ${focalboardViewId}`);
    console.log(`Focalboard base URL: ${focalboardBaseUrl}`);

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
      cardsWithFocalboardUrl: 0,
    };

    // Mapping of Focalboard card ID to Planka card ID (for comments import)
    const cardIdMapping = {};

    const hasCustomFields = customFieldGroup && customFieldIdByFocalboardPropertyId &&
      Object.keys(customFieldIdByFocalboardPropertyId).length > 0;

    // Process each list
    for (const [listId, cards] of Object.entries(cardsByListId)) {
      if (cards.length === 0) continue;

      const list = listById[listId];
      const listName = list?.name || 'Unknown';

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
            dueDate = sails.helpers.focalboard.parseDate(dueDateRaw);

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
            listChangedAt: new Date().toISOString(),
            creatorUserId: creatorPlankaId || null,
            createdAt: focalboardCard.createAt
              ? new Date(focalboardCard.createAt).toISOString()
              : undefined,
          };

          if (!focalboardCard.title?.trim()) {
            stats.cardsWithoutTitle += 1;
          }

          const card = await Card.qm.createOne(cardValues);

          // Store mapping for comments import
          cardIdMapping[focalboardCard.id] = card.id;

          if (creatorPlankaId) {
            stats.cardsWithCreator++;
          }

          stats.totalCardsImported += 1;

          // Create CREATE_CARD action with original Focalboard timestamp.
          // We bypass sails.helpers.actions.createOne to avoid triggering
          // webhooks, sockets, and notifications during bulk import.
          // userId falls back to actorUser (the importer) if the original
          // Focalboard creator has no matching Planka account.
          await Action.qm.createOne({
            boardId,
            cardId: card.id,
            userId: creatorPlankaId || actorUser.id,
            type: Action.Types.CREATE_CARD,
            data: {
              card: { name: card.name },
              list: { id: list.id, type: list.type, name: list.name },
            },
            createdAt: card.createdAt,
          });

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
                      cardId: card.id,
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
                      cardId: card.id,
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
                    cardId: card.id,
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

          // Create Focalboard URL custom field value
          if (focalboardUrlFieldId && focalboardBaseUrl && focalboardViewId) {
            const url = `${focalboardBaseUrl}/${focalboardCard.boardId}/${focalboardViewId}/${focalboardCard.id}`;

            await CustomFieldValue.qm.createOrUpdateOne({
              cardId: card.id,
              customFieldGroupId: customFieldGroup.id,
              customFieldId: focalboardUrlFieldId,
              content: url,
            });

            stats.cardsWithFocalboardUrl += 1;
          }
        }),
      );

      console.log(`Created ${cards.length} cards in list "${listName}"`);
    }

    return { stats, cardIdMapping };
  },
};
