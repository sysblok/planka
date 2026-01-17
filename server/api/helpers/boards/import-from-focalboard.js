/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Focalboard property name for due date (will be looked up by name)
const DUE_DATE_PROPERTY_NAME = 'Дедлайн';

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

    // Find the due date property by name
    const dueDateProperty = boardBlock.cardProperties?.find(
      (p) => p.name === DUE_DATE_PROPERTY_NAME && p.type === 'date'
    );
    const dueDatePropertyId = dueDateProperty?.id || null;

    if (dueDatePropertyId) {
      console.log(`Due date property found: "${DUE_DATE_PROPERTY_NAME}" (${dueDatePropertyId})`);
    } else {
      console.log(`Due date property "${DUE_DATE_PROPERTY_NAME}" not found, skipping due dates`);
    }

    // =====================================================
    // IMPORT LABELS
    // =====================================================

    const labelIdByFocalboardLabelId = await sails.helpers.boards.importFocalboardLabels(
      inputs.board.id,
      focalboardLabels,
    );

    // =====================================================
    // LISTS SECTION
    // =====================================================
    const { listIdByOptionId, unorderedListId, unorderedListName } =
      await sails.helpers.boards.importFocalboardLists(
        inputs.board.id,
        kanbanView.fields?.visibleOptionIds || [],
        columnProperty.options,
      );

    // =====================================================
    // GROUP CARDS BY LIST
    // =====================================================
    const cardsByListId = sails.helpers.boards.groupFocalboardCardsByList(
      focalboardCards,
      kanbanView.fields.cardOrder || [],
      columnPropertyId,
      listIdByOptionId,
      unorderedListId,
      unorderedListName,
      columnProperty.options,
    );

    // =====================================================
    // IMPORT CUSTOM FIELDS
    // =====================================================

    const { customFieldGroup, customFieldIdByFocalboardPropertyId } =
    await sails.helpers.boards.importFocalboardCustomFields(
      inputs.board.id,
      boardBlock.cardProperties || [],
    );

    // =====================================================
    // IMPORT CARDS
    // =====================================================

    const stats = await sails.helpers.boards.importFocalboardCards(
      inputs.board.id,
      cardsByListId,
      textBlocks,
      dueDatePropertyId,
      labelPropertyId,
      labelIdByFocalboardLabelId,
      listIdByOptionId,
      columnProperty.options,
      unorderedListName,
      customFieldGroup,
      customFieldIdByFocalboardPropertyId,
    );

    // =====================================================
    // SUMMARY
    // =====================================================

    console.log('');
    console.log('=== Import Complete ===');
    console.log(`Total cards imported: ${stats.totalCardsImported}`);
    console.log(`Cards without title (named "Untitled"): ${stats.cardsWithoutTitle}`);
    console.log(`Cards with descriptions: ${stats.cardsWithDescriptions}`);
    console.log(`Cards with labels: ${stats.cardsWithLabels}`);
    console.log(`Cards with due date: ${stats.cardsWithDueDate}`);
    console.log(`Cards with custom fields: ${stats.cardsWithCustomFields}`);
    console.log(`Custom field values created: ${stats.customFieldValuesCreated}`);
    console.log(`Labels created: ${Object.keys(labelIdByFocalboardLabelId).length}`);
    console.log(`Lists created: ${Object.keys(listIdByOptionId).length + 1} (including "${unorderedListName}")`);
    console.log(`Custom fields created: ${Object.keys(customFieldIdByFocalboardPropertyId).length}`);
    console.log('');
  },
};
