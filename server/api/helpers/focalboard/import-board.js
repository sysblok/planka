/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @description :: Main orchestrator for Focalboard import.
 *                 Coordinates labels, lists, cards, and custom fields import.
 */

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
    actorUser: {
      type: 'ref',
      required: true,
      description: 'The user who triggered the import (used as fallback action creator)',
    },
  },

  async fn(inputs) {
    const {
      board: boardBlock,
      views,
      cards: focalboardCards,
      textBlocks,
      comments,
      checkboxes,
      boardMembers,
      users,
      columnProperty,
      labels: focalboardLabels,
      labelPropertyId,
      dueDatePropertyId,
      assigneePropertyId,
      customFieldProperties,
    } = inputs.focalboardData;

    // Find the Kanban view
    const kanbanView = views.find((view) => view.fields.viewType === 'board');
    if (!kanbanView) {
      throw new Error('No Kanban view found in Focalboard data');
    }

    console.log(`Using Kanban view: ${kanbanView.title}`);
    console.log(`Column property: ${columnProperty.name} (${columnProperty.type})`);
    console.log(`Total column options: ${columnProperty.options.length}`);

    if (labelPropertyId) {
      console.log(`Label property ID: ${labelPropertyId}`);
      console.log(`Total labels: ${focalboardLabels.length}`);
    } else {
      console.log('No label property selected');
    }

    if (dueDatePropertyId) {
      console.log(`Due date property ID: ${dueDatePropertyId}`);
    } else {
      console.log('No due date property selected');
    }

    if (customFieldProperties && customFieldProperties.length > 0) {
      console.log(`Custom fields to import: ${customFieldProperties.length}`);
      customFieldProperties.forEach((p) => console.log(`  - ${p.name} (${p.type})`));
    } else {
      console.log('No custom fields selected');
    }

    // =====================================================
    // BUILD USER MAPPING
    // =====================================================
    const userMappingResult = await sails.helpers.focalboard.buildUserMapping(users);
    const userMapping = userMappingResult.focalboardUserIdToPlankaUserId;

    // =====================================================
    // IMPORT BOARD MEMBERS
    // =====================================================

    await sails.helpers.focalboard.importBoardMembers(
      inputs.board.id,
      inputs.board.projectId,
      boardMembers,
      userMapping
    );

    // =====================================================
    // IMPORT LABELS
    // =====================================================

    const labelIdByFocalboardLabelId = await sails.helpers.focalboard.importLabels(
      inputs.board.id,
      focalboardLabels || [],
    );

    // =====================================================
    // LISTS SECTION
    // =====================================================
    const { listIdByOptionId, listById, unorderedList } =
      await sails.helpers.focalboard.importLists(
        inputs.board.id,
        kanbanView.fields?.visibleOptionIds || [],
        columnProperty.options,
      );

    // =====================================================
    // GROUP CARDS BY LIST
    // =====================================================

    const columnPropertyId = columnProperty.id;

    const cardsByListId = sails.helpers.focalboard.groupCardsByList(
      focalboardCards,
      kanbanView.fields.cardOrder || [],
      columnPropertyId,
      listIdByOptionId,
      unorderedList.id,
      unorderedList.name,
      columnProperty.options,
    );

    // =====================================================
    // IMPORT CUSTOM FIELDS
    // =====================================================

    let customFieldGroup = null;
    let customFieldIdByFocalboardPropertyId = {};

    if (customFieldProperties && customFieldProperties.length > 0) {
      const result = await sails.helpers.focalboard.importCustomFields(
        inputs.board.id,
        customFieldProperties,
      );
      customFieldGroup = result.customFieldGroup;
      customFieldIdByFocalboardPropertyId = result.customFieldIdByFocalboardPropertyId;
    }

    // =====================================================
    // IMPORT CARDS
    // =====================================================

    const { stats, cardIdMapping } = await sails.helpers.focalboard.importCards(
      inputs.board.id,
      cardsByListId,
      textBlocks,
      dueDatePropertyId,
      labelPropertyId,
      labelIdByFocalboardLabelId,
      listById,
      assigneePropertyId,
      userMapping,
      inputs.actorUser,
      customFieldGroup,
      customFieldIdByFocalboardPropertyId,
    );

    // =====================================================
    // IMPORT COMMENTS
    // =====================================================

    const commentStats = await sails.helpers.focalboard.importComments(
      comments || [],
      cardIdMapping,
      userMapping,
      users,
    );

    // =====================================================
    // IMPORT CHECKBOXES (as TaskLists/Tasks)
    // =====================================================

    const checkboxStats = await sails.helpers.focalboard.importCheckboxes(
      checkboxes || [],
      cardIdMapping,
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
    console.log(`Cards with creator: ${stats.cardsWithCreator}`);
    console.log(`Cards with members: ${stats.cardsWithMembers}`);
    console.log(`Card memberships created: ${stats.cardMembershipsCreated}`);
    console.log(`Labels created: ${Object.keys(labelIdByFocalboardLabelId).length}`);
    console.log(`Lists created: ${Object.keys(listIdByOptionId).length + 1} (including "${unorderedList.name}")`);
    console.log(`Custom fields created: ${Object.keys(customFieldIdByFocalboardPropertyId).length}`);
    console.log(`Comments imported: ${commentStats.totalCommentsImported}`);
    console.log(`Comments with matched user: ${commentStats.commentsWithUser}`);
    console.log(`Comments without matched user: ${commentStats.commentsWithoutUser}`);
    console.log(`TaskLists created: ${checkboxStats.totalTaskListsCreated}`);
    console.log(`Tasks created: ${checkboxStats.totalTasksCreated}`);
    console.log('');
  },
};
