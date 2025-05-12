# Tilings

## Classification

A tiling is a covering of the plane using one or more geometric shapes, called tiles, with no overlaps and no gaps. In mathematics, tilings are studied in various contexts and have applications in crystallography, material science, and art.

### The 15 valid vertex shapes

When trying to analyze tilings in a rigorous way, the first thing we need to consider is how many ways there are to build vertices, i.e. what are the different combinations of regular polygons that, when wrapped around a point, cover exactly 360°.

Turns out that there are only 21 ways to do that:

| # | | | | | | | | | | |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| $3$ | ![3.7.42](../theory/images/vertexTypes/3.7.42.png) | ![3.8.24](../theory/images/vertexTypes/3.8.24.png) | ![3.9.18](../theory/images/vertexTypes/3.9.18.png) | ![3.10.15](../theory/images/vertexTypes/3.10.15.png) | ![3.12^2](../theory/images/vertexTypes/3.12^2.png) | ![4.5.20](../theory/images/vertexTypes/4.5.20.png) | ![4.6.12](../theory/images/vertexTypes/4.6.12.png) | ![4.8^2](../theory/images/vertexTypes/4.8^2.png) | ![5^2.10](../theory/images/vertexTypes/5^2.10.png) | ![6^3](../theory/images/vertexTypes/6^3.png) |
| | $\textcolor{lightcoral}{3.7.42}$ | $\textcolor{lightcoral}{3.8.24}$ | $\textcolor{lightcoral}{3.9.18}$ | $\textcolor{lightcoral}{3.10.15}$ | $\textcolor{lightgreen}{3.12^2}$ | $\textcolor{lightcoral}{4.5.20}$ | $\textcolor{lightgreen}{4.6.12}$ | $\textcolor{lightgreen}{4.8^2}$ | $\textcolor{lightcoral}{5^2.10}$ | $\textcolor{lightgreen}{6^3}$ |
| $4$ | ![3.4.3.12](../theory/images/vertexTypes/3.4.3.12.png) | ![3.4.6.4](../theory/images/vertexTypes/3.4.6.4.png) | ![3.4^2.6](../theory/images/vertexTypes/3.4^2.6.png) | ![3^2.4.12](../theory/images/vertexTypes/3^2.4.12.png) | ![3^2.6^2](../theory/images/vertexTypes/3^2.6^2.png) | ![3.6.3.6](../theory/images/vertexTypes/3.6.3.6.png) | ![4^4](../theory/images/vertexTypes/4^4.png) | | | |
| | $\textcolor{lightgreen}{3.4.3.12}$ | $\textcolor{lightgreen}{3.4.6.4}$ | $\textcolor{lightgreen}{3.4^2.6}$ | $\textcolor{lightgreen}{3^2.4.12}$ | $\textcolor{lightgreen}{3^2.6^2}$ | $\textcolor{lightgreen}{3.6.3.6}$ | $\textcolor{lightgreen}{4^4}$ | | | |
| $5$ | ![3^2.4.3.4](../theory/images/vertexTypes/3^2.4.3.4.png) | ![3^3.4^2](../theory/images/vertexTypes/3^3.4^2.png) | ![3^4.6](../theory/images/vertexTypes/3^4.6.png) | | | | | | | |
| | $\textcolor{lightgreen}{3^2.4.3.4}$ | $\textcolor{lightgreen}{3^3.4^2}$ | $\textcolor{lightgreen}{3^4.6}$ | | | | | | | |
| $6$ | ![3^6](../theory/images/vertexTypes/3^6.png) | | | | | | | | | |
| | $\textcolor{lightgreen}{3^6}$ | | | | | | | | | |

Of which only 15 can generate valid tilings (in green).

### Regular Tilings

Regular tilings are composed of regular polygons arranged in a way that every vertex looks the same. There are only three regular tilings of the plane: triangular, square, and hexagonal.

| ![3^6](../tilings/1Ur/3_r60_r(h2).png) | ![4^4](../tilings/1Ur/4-4-0,4_r90_m(v2).png) | ![6^3](../tilings/1Ur/6_r60_r(h1).png) |
| :---: | :---: | :---: |
| $3^6$ | $4^4$ | $6^3$ |

### Semi-Regular Tilings

Semi-regular tilings use two or more regular polygons, with the same arrangement of polygons at each vertex. There are eight semi-regular tilings (also known as Archimedean tilings):

| ![3^4.6](../tilings/1Usr/6-3-3_r60_r(h5).png) | ![3.3.3.3.6](../tilings/1Usr/4-3_m90_r(h2).png) | ![3.3.3.4](../tilings/1Usr/4-3-3,0,0,0,4_r90_r(h2).png) | ![3.12.12](../tilings/1Usr/6-4-3_m30_r(c2).png) |
| :---: | :---: | :---: | :---: |
| $3^4.6$ (Snub trihexagonal)| $3^3.4^2$ (Elongated triangular) | $3^2.4.3.4$ (Snub square) | $3.4.6.4$ (Rhombitrihexagonal) |
| ![(3.6)^2](../tilings/1Usr/6-3-6_m30_r(v4).png) | ![3.12^2](../tilings/1Usr/12-3_m30_r(h3).png) | ![4.6.12](../tilings/1Usr/12-6,4_m30_r(c2).png) | ![4.8^2](../tilings/1Usr/8-4_m90_r(h4).png) |
| $(3.6)^2$ (Trihexagonal) | $3.12^2$ (Truncated hexagonal) | $4.6.12$ (Truncated trihexagonal) | $4.8^2$ (Truncated square) |

Tilings can be categorized based on various properties:

### Symmetry Groups

Tilings can be classified by their symmetry groups. The 17 wallpaper groups describe all possible symmetry types of periodic tilings in the Euclidean plane.

### Regularity

Tilings can be regular, semi-regular, demi-regular, or irregular based on the types of polygons used and vertex configurations.

### Periodicity

Periodic tilings repeat in a regular pattern, while aperiodic tilings (like Penrose tilings) do not have translational symmetry.

For now, we only have $k$-uniform periodic tilings available, but in the future we plan on introducing different types and ways to construct them.

## Generation Method

In this application, we generate tilings using a systematic approach based on mathematical rules:

### Rule Strings

The rule strings define the base shape, orientation, and transformations to generate a specific tiling pattern. For example,

$$
\text{4/m45/r(h1)}
$$

defines a square tiling with a 45-degree rotation.

### Transformations

We apply transformations like rotations, translations, and reflections to create complex patterns from simple base shapes. The number of transformation steps determines the complexity of the resulting pattern.

# Conway's Game of Life

## Definition
Conway's Game of Life is a two-dimensional cellular automaton created by John
Conway in 1970. It's a zero-player game where evolution is determined by the initial state.
Despite its very simple rules, it exhibits complex and often unpredictable behaviors.

In its original version, the Game of Life operates on an infinite grid of
square cells. Each cell can be in one of two states: dead or alive. At every
iteration, the state of each cell evolves according to the following rules:

* Any alive cell with fewer than 2 alive neighbors dies (underpopulation).
* Any alive cell with 2 or 3 alive neighbors survives to the next generation.
* Any alive cell with more than 3 alive neighbors dies (overpopulation).
* Any dead cell with exactly 3 alive neighbors becomes alive (reproduction).

These transition rules are concisely described by the string **B3/S23**, where
**B3** indicates birth on exactly three neighbors, and **S23** indicates
survival on two or three neighbors.

![gol](./images/videos/gol.gif)

### Patterns

Various patterns can emerge:

* Still lifes: Patterns that don't change
* Oscillators: Patterns that repeat after a fixed number of generations
* Spaceships: Patterns that translate across the grid
* Methuselahs: Patterns that evolve for many generations before stabilizing

![still life](videos/still_life.gif)
![oscillator](videos/oscillators.gif)
![spaceships](videos/spaceships.gif)
![methuselahs](videos/methuselahs.gif)

## Extensions
We also explored some extensions of the Game of Life:

### Generations

In the "Generations" variant, cells can pass through intermediate states between
alive and dead before fully transitioning. Each cell is associated with a small integer
counter that represents its "age".
Rules specify both birth thresholds and decay durations,
producing interesting phenomena that are not possible
in the binary model.

![generations1](./images/videos/generations.gif)

### Larger than Life

"Larger than Life" generalizes the neighborhood radius beyond the immediate
adjacent cells. Instead of counting only the eight nearest neighbors, these
rules consider all cells within a specified radius *r* on the grid, with
distinct birth and survival intervals defined over that neighborhood.

### Non-square grids

The underlying grid can be replaced by arbitrary tilings or graphs, allowing
each cell to have a non-uniform number of neighbors. Examples include hexagonal
tilings, Penrose tilings, and irregular networks. Despite the change in
topology, the life-like rules (B/S strings) apply uniformly based on each
cell's local neighbor count, unlocking new pattern classes and emergent
structures.

![NonSquare1](./images/videos/tiling1.gif)
![NonSquare2](./images/videos/tiling2.gif)
![NonSquare3](./images/videos/tiling3.gif)

## Searching for interesting rules

One thing that one can realize while trying rules and tilings on the simulator
is that it is really hard to find interesting rules, especially on complex
tilings.

In order to define what a rule should satisfy to be "interesting", we
used the following metrics:

### Used metrics

These metrics are presented in **Life Worth Mentioning: Complexity in Life-Like Cellular Automata**
Peña et al.

To systematically compare the dynamical regimes generated by different rules,
the authors employ two complementary information-theoretic metrics computed on each
configuration:

* **Density ($\rho$).** The fraction of live cells in the system,
  $$
  \rho=\dfrac{1}{N}\sum_i s_i
  $$
  where $s_i\in\{0,1\}$ and $N$ is the total
  number of cells. Density measures the overall activity or fill ratio.

* **Statistical complexity ($D$).** The difference between the marginal entropy
  of the cell-state distribution,
  $$
  H(S)=-\rho\log_2\rho - (1-\rho)\log_2(1-\rho)
  $$
  and the average conditional entropy given a neighboring cell,

  $$
  G=\langle H(S|U)\rangle, \quad H(S|U)=-\sum_{s,u}P(s,u)\log_2\dfrac{P(s,u)}{P(u)}
  $$

  so that $D=H(S)-G$. Larger $D$ indicates more non-random spatial organization
  beyond what is expected from density alone.

By plotting rules in the 2D density–complexity plane, they managed to find similar
behaviors and identify those that produce the richest dynamics, such as
**B3/S23**.

We tried to use these metrics to search for interesting rules on non-square
tilings.

### Parallel computing

Let us now think about the number of iterations of the automaton we need to compute.

1. 1000 iterations
2. 100 random starts
3. all possible rules, which is $2^(n+1)$, where $n$ is the maximum number of neighbors
of each cell.

It is easy to see that this number is very big, making the computation impossible
to be ran sequentially.

The strategy that we employed to run the simulation is to parallelize it as much
as possible. In order to do this, we used the Taichi framework running on a machine
using a GPU card.

The cellular state array is stored as a field on the GPU, and all the update rules
and metric computations as expressed as Taichi kernels, that are then ran in
parallel.

More practically, what happens is this:

- Using the current frame state, all the alive neighbor counts are computed
in parallel, for all the cells and for all the random starts.
- Using the neighbor counts, the state of the next iteration is computed in
parallel, according to the rule that is being tested.
- The current frame is discarded and replaced by the one just created,
and the metrics are computed.

This procedure is then applied for each rule and for each tiling.

The code responsible for this part is `tiling_metrics.py`, which loads the
tiling exported from the web simulator and runs the simulation.

In order to run this code on a machine with a powerful GPU, we made use of the cluster
provided by DTU. The file responsible for creating the job that runs the simulation
is `job.lsf`.


### Results
We ran the simulation on 3 different tilings. We put a limit of 8 maximum neighbors
on all of them (meaning that rules with more than 8 neighbors were not considered).

The tilings that were used are the following:

### Future work

