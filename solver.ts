// Copyright (c) 2016, Sebastien Sydney Robert Bigot
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// The views and conclusions contained in the software and documentation are those
// of the authors and should not be interpreted as representing official policies,
// either expressed or implied, of the FreeBSD Project.

import Mesh = require('./mesh');

import dmn = require('./domain');
import Domain = dmn.Domain;
import DomainType = dmn.DomainType;

import * as numeric from 'numeric';

interface ProgressFunc {
    (progress: number): void;
}


class Solver {

    public constructor(rotor: Mesh, stator: Mesh) {
        this.rotor = rotor;
        this.stator = stator;
    };

    public solve(rpm: number, progress: ProgressFunc): Array<[number[], number[]]> {

        function remapSolution(solution: number[], domain: Domain): number[] {
            var nverts = domain.mesh.vertices.length / 2;
            var remapped = new Array<number>(nverts);
            for (var vi = 0; vi < nverts; ++vi) {
                remapped[vi] = domain.coeff[vi] * solution[domain.v2dof[vi]];
            }
            return remapped;
        }

        var sols: Array<[number[], number[]]> = [];
        var lastsol: [number[], number[]] = [numeric.rep([this.rotor.vertices.length], 0), numeric.rep([this.stator.vertices.length], 0)];

        var dt = 60 / (12 * 32 * rpm);

        var rotor = new Domain(this.rotor);
        var stator = new Domain(this.stator);

        for (var i = -32; i < 32; ++i) {
            var theta = i * Math.PI / (6 * 32);

            var [A, b] = Solver.assemble(rotor, stator, lastsol, theta, dt, i * dt);

            var SA = numeric.ccsSparse(A);
            var LUP = numeric.ccsLUP(SA, 1);
            var sol = numeric.ccsLUPSolve(LUP, b);

            lastsol = [remapSolution(sol, rotor), remapSolution(sol, stator)];

            progress((33.0 + i) / 64);

            sols.push(lastsol);
        }

        return sols;
    };

    private static assemble(rotor: Domain,
        stator: Domain,
        prevsol: [number[], number[]],
        rotation: number,
        dt: number,
        t: number): [number[][], number[]] {

        rotor.applyAntiPeriodicBoundaryConditions(rotation);
        stator.applyAntiPeriodicBoundaryConditions(rotation);
        var ndof = Domain.joinSlidingDomains(rotor, stator, rotation);

        var A: number[][] = numeric.rep([ndof, ndof], 0);
        var b: number[] = numeric.rep([ndof], 0);

        Solver.assembleOne(rotor, prevsol[0], dt, t, A, b);
        Solver.assembleOne(stator, prevsol[1], dt, t, A, b);

        return [A, b];
    };

    private static assembleOne(domain: Domain, prevsol: number[], dt: number, t: number, A: number[][], b: number[]) {

        // Nodal admittance matrix
        var Y: number[][] = numeric.rep([2, 2], 0);
        Y[0][0] = 1 / Solver.Ra;
        Y[1][1] = 1 / Solver.Ri;
        var nphases = Y.length;

        var [flux, wflux] = Solver.computeFlux(domain, prevsol, nphases);

        var mesh = domain.mesh;
        var v2dof = domain.v2dof;
        var coeff = domain.coeff;
        var tris = mesh.triangles;

        for (var vi = 0; vi < domain.mesh.vertices.length / 2; ++vi) {

            domain.rct.forEach(vi, function (ti) {

                var si = tris[3 * ti] == vi ? 0 : (tris[3 * ti + 1] == vi ? 1 : 2);
                var qi = (si + 1) % 3;

                var area = domain.area[ti];

                for (var sj = 0; sj < 3; ++sj) {
                    var vj = tris[3 * ti + sj];
                    var qj = (sj + 1) % 3;

                    var c = 0.0;
                    c += Solver.sigma(domain.mesh.domainIndex[ti]) * (si == sj ? area / 6 : area / 12) / dt;
                    c += Solver.reluctance(domain.mesh.domainIndex[ti]) * numeric.dot(domain.q[ti][qi], domain.q[ti][qj]) / (4 * area);

                    A[v2dof[vi]][v2dof[vj]] += coeff[vi] * coeff[vj] * c;
                }

                var io = (si + 1) % 3;
                var ioo = (si + 2) % 3;
                var vio = tris[3 * ti + io];
                var vioo = tris[3 * ti + ioo];

                var c = 0.0;
                c += Solver.sigma(domain.mesh.domainIndex[ti]) * (area * (2 * prevsol[vi] + prevsol[vio] + prevsol[vioo]) / 12) / dt;
                c += Solver.I0(domain.mesh.domainIndex[ti], t) * area / 3;

                b[v2dof[vi]] += coeff[vi] * c;
            });

            if (domain.phases.contains(vi)) {

                var u = numeric.dot(Y, wflux[vi]);

                domain.phases.forEach(function (vj) {
                    A[v2dof[vi]][v2dof[vj]] += coeff[vi] * coeff[vj] * Solver.h * numeric.dot(u, wflux[vj]) / dt;
                });

                b[v2dof[vi]] += coeff[vi] * Solver.h * numeric.dot(u, flux) / dt;
            }
        }

        // Apply the 0 vector potential Dirichlet boundary condition outside the stator.
        domain.outside.forEach(function (vi) {
            var d = v2dof[vi];
            A[d][d] = Solver.kDirichletPenalty;
            b[d] = 0;
        });

    };

    private static computeFlux(domain: Domain, prevsol: number[], nphases: number): [number[], number[][]] {

        var mesh = domain.mesh;
        var nverts = mesh.vertices.length / 2;
        var tris = mesh.triangles;

        var flux: number[] = numeric.rep([nphases], 0);
        var wflux: number[][] = numeric.rep([nverts, nphases], 0);

        domain.phases.forEach(function (vi) {
            domain.rct.forEach(vi, function (ti) {
                var area = domain.area[ti];
                // Sum the prev sol over that triangle. 
                // We will divide again later one since we account for all triangles thrice
                var solint = area * (prevsol[tris[3 * ti]] + prevsol[tris[3 * ti + 1]] + prevsol[tris[3 * ti + 2]]) / 3;
                var wfluxvi = wflux[vi];
                var psi = Solver.psi(domain, mesh.domainIndex[ti]);
                switch (mesh.domainIndex[ti]) {
                    case DomainType.SupplyCoilA:
                    case DomainType.SupplyCoilB:
                        wfluxvi[0] += psi * area / 3;
                        flux[0] += psi * solint / 3;
                        break;
                    case DomainType.InductorCoilB:
                    case DomainType.InductorCoilA:
                        wfluxvi[1] += psi * area / 3;
                        flux[1] += psi * solint / 3;
                        break;
                    default:
                        break;
                }
            });
        });

        return [flux, wflux];
    }

    private static reluctance(domain: DomainType): number {
        var vacuum = 4e-7 * Math.PI;
        switch (domain) {
            case DomainType.RotorIron:
            case DomainType.StatorIron:
                var iron = 0.51636e-3;
                return iron / vacuum;
            default:
                return 1 / vacuum;
        }
    };

    private static psi(domain: Domain, domainType: DomainType): number {
        var area = domain.areaPerDomainType[domainType];
        switch (domainType) {
            case DomainType.SupplyCoilA:
            case DomainType.SupplyCoilB:
                return Solver.Na / area;
            case DomainType.InductorCoilA:
                return Solver.Ni / area;
            case DomainType.InductorCoilB:
                return -Solver.Ni / area;

            default:
                return 0;
        }
    };

    private static I0(domain: DomainType, t: number): number {
        switch (domain) {
            case DomainType.SupplyCoilA:
            case DomainType.SupplyCoilB:
                return (Solver.Va * Math.sin(2 * Math.PI * t * Solver.Fa) / Solver.Ra) * Solver.sigma(domain);
            default:
                return 0;
        }
    };

    private static sigma(domain: DomainType): number {
        switch (domain) {
            case DomainType.SupplyCoilA:
            case DomainType.SupplyCoilB:
            case DomainType.InductorCoilB:
            case DomainType.InductorCoilA:
            case DomainType.RotorCopper:
                return 50e6;
            default:
                return 0;
        }
    };

    static kEpsilon = 10e-6;
    static kDirichletPenalty = 10e9;

    static h = 0.050; // meter

    static Va = 15; // Volt peak to peak
    static Fa = 50; // Hertz
    static Ra = 1; // Ohm

    static Ri = 1000; // Ohm

    static Na = 50; // turn per 1/2 winding slot
    static Ni = 30; // turn per 1/2 winding slot

    rotor: Mesh;
    stator: Mesh;
};
export = Solver;
