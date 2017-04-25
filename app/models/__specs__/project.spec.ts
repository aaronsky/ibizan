import 'mocha';
import { expect } from 'chai';

import { Rows } from '../rows';
import { Project } from '../project';

const TEST_ROW = Rows.ProjectsRow.create({
    values: ['#production', '1/1/2014', '100'],
    range: ''
});
const BAD_ROW = Rows.ProjectsRow.create({
    values: ['#production', '1/1/2014', 'jeff'],
    range: ''
});

describe('Project', () => {
    describe('.parse(row)', () => {
        it('should return undefined when a row is not provided', () => {
            const project = Project.parse(null);
            expect(project).to.not.exist;
        });
        it('should return a project when passed a row', () => {
            const project = Project.parse(TEST_ROW);
            expect(project).to.have.property('name', 'production');
            expect(project).to.have.property('start');
            expect(project).to.have.property('total', 100);
        });
        it('should handle bad data gracefully', () => {
            const project = Project.parse(BAD_ROW);
            expect(project).to.have.property('name', 'production');
            expect(project).to.have.property('start');
            expect(project).to.have.property('total', 0);
        });
    });
    describe('#updateRow()', () => {

    });
    describe('#description()', () => {
        it('should return a description of the project for output', () => {
            const description = Project.parse(TEST_ROW).description();
            expect(description).to.exist;
        })
    });
});
