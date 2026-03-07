# Algorithm

## Overview

The objective is to design an algorithm capable of generating valid tilings of the plane starting from a set of polygons. We will classify these tilings based on their $k$-transitivity property and the categories of polygons they contain.

![[Pasted image 20260220191210.png]]

The algorithm is composed of 7 parts:
1. **select polygon categories**: select the polygon categories to include in the tilings (regular, regular star, parametric star, irregular convex, etc.), and some parameters to limit the polygons space.
2. **generate vertex configuration set**: build all possible vcs from that set of polygons.
3. **compute the vc compatibility graph**: build a graph where each node represents a unique vc. Any two vcs are connected iff they're compatible with each other, i.e., if they can be stitched together.
4. **select seed set**: compute, for a selected parameter $k$, a list of all possible combinations of $k$ compatible vcs (with replacement).
5. **build the seed**: for each vc set, build all unique $k$-seeds composed of exactly the vcs in the set.
6. **apply the wallpaper group**: for each generated $k$-seed, we iterate through the 17 wallpaper groups and check whether it can be applied to the seed. If so, generate the corresponding tiling.
7.  **perform final checks**: check the generated tiling for gaps, overlaps, and compare the wanted $k$ with the actual unique VCs under transitivity

## 1. Select the polygon categories

The first thing to decide is what kind of polygons we will use to generate the tilings. In this thesis we will constrain the search to edge-to-edge $k$-uniform tilings, but the hope is to make the algorithm flexible enough to be extended to other types.

![[Pasted image 20260220200509.png]]

### Categories

#### Regular polygons

Regular polygons are convex equilateral, and equiangular polygons, and can be represented with the notation $n$, where $n$ is the number of edges (and vertices):

![[Pasted image 20260224130845.png]]

#### Regular star polygons

A regular star polygon is a self-intersecting, equilateral, and equiangular polygon constructed by taking $n$ equally spaced points on the circumference and connect each of them with the $d$-th ones in both direction. They are represented with the notation $\{n/d\}$. 
An alternative definition considers a star polygon the corresponding $2n$-gon, which won't have any self-intersections. The standard notation in this case is $|n/d|$.
In the context of this thesis, we will work with the latter, but we will use the notation $\{n|d\}$ to represent them.

![[Pasted image 20260224130916.png]]

The equations for the internal angles $\alpha$ and $\beta$ (at vertex and dent respectively) are:

$$\alpha=\pi\left(1-\dfrac{2d}n\right),\quad\beta=\pi\left(1+\dfrac{2(d-1)}n\right)$$

#### Isotoxal star simple polygons

An isotoxal star polygons are a superset of regular star polygons, and they can be represented with the notation $\{n_\alpha\}$. Such a polygon is a $2n$-gon with alternating vertices at two different radii.
For the isotoxal star simple polygons, since the parameter is $\alpha\in\mathbb R,\ \alpha\in\left]0,\pi\dfrac{n-2}n\right[$, the search would be difficult to set up.

Instead, we could constrain it to be a divisor of $2\pi$ and search for values of: $\alpha\in\left]0,\pi\dfrac{n-2}n\right[,\ \alpha=q2\pi,q\lt 1,q\in\mathbb Q$.

The notation we will use for these is $\{n|\alpha\}$. For example, $\{3|30\}$ is a $3$-pointed star polygon with $\alpha=30°\implies\beta=210°$ as angles.

![[Pasted image 20260224130945.png]]

For all star the following equation holds:
$$\alpha+\beta=2\pi\left(1-\dfrac1n\right)$$

For this category of polygons, $\alpha$ is given, so we can get $\beta$ as such:
$$\beta=2\pi\left(1-\dfrac1n\right)-\alpha$$

#### Convex composite (or decomposable) equilateral polygons

This category is composed of only $7$ unique polygons, (plus the regular dodecagon, which can be decomposed in a hexagon surrounded by squares and triangles, not in figure).

![[IMG_0418.PNG|500]]

I think it would be interesting to generate some tilings with these because I'm expecting to get the same tilings I would get with only regular polygons, where groups of them are replaced by these composite ones. 
I haven't searched that much in the literature for these, but I haven't seen any tilings using these intentionally.

#### Convex equilateral irregular polygons

The last category is that of convex equilateral irregular polygons (a superset of the composite ones), which are all convex polygons with edge length $1$ with where not all internal angles are the same. As for the isotoxal star polygons, we select an angle parameter $\alpha$ and constraint the generation to only those which internal angles are multiple of $\alpha$.

![[Pasted image 20260224134447.png]]

### Explored combinations

#### Thesis' focus

My focus will be to enumerate all tilings up to a certain $k$, for the following combinations:
- **just regular polygons**: first I will try to match the known values for $k$-uniform tilings up to $k=6$)

As for star polygons, in Tilings and Patterns, they put regular and isotoxal simple star polygon in the same "regular star" category, but I want to differentiate between:
- **regular polygons and regular star polygons**
- **regular polygons and all star polygons**

First I will compare my results to the list provided in [this paper](https://www.polyomino.org.uk/publications/2009/star-polygon-tiling-2-uniform.pdf), and then explore higher values of $k$.

#### Further experiments

Additionally, here are some choices I want to explore:
- regular polygons and convex decomposable equilateral polygons
- regular polygons and convex equilateral irregular polygons  
- other combinations

The approach would thus be to gradually add categories of polygons and explore different tiling spaces, and categorize them, but with these last category combinations, I expect the search to explode. 
Therefore, it's not my goal to enumerate the tilings for specific values of $k$, but rather generate some examples, also to test the algorithm's robustness and the potential use of it. If it works, one could answers questions like, "Can I generate valid tilings using only this small subset of polygons/vertex configurations? How many unique would I get?".


## 2. Generate the vertex configuration set
Once we have decided which set of polygons we allow in the tiling, we need to generate all possible vertex configurations that include such polygons.

### Unique vertices

For each polygon, we need to list the unique vertices, i.e., the minimal set of vertices such that any two vertices in the set are not transitive under notations. Each of them will also have an angle associated. While for regular polygons, all vertices are the same, star polygons have vertices and dents, the vertices on the outer and inner radius respectively. Irregular polygons have at least two unique vertices.
For convenience, it's easier to generate different version of the same polygon during the first step, rather than extracting them after.

![[Pasted image 20260225125027.png]]

### DFS search

We run a DFS on the polygons, starting from the "empty" vertex configuration (just the vertex), and adding them around it until we cover $360°$, backtracking when we find overlaps or if we exceed the $360°$.
The following is a partial example with the starting set of just regular triangle, square, regular hexagon, regular octagon, regular dodecagon:

![[WhatsApp Image 2026-02-13 at 23.59.48 (1).jpeg]]

### Filtering

The result is a set $VC$ of vertex configurations, which we need to filter to remove all rotational symmetries.
To do this, we just check if the name of the configuration, i.e., the name of all polygons, sorted around the vertex and separated by a comma, is the minimum lexicographical ordering. This ensure that we keep only one version of each vertex configuration.

### Results

For just the regular polygons, it's been proven that there are $21$ vertex configurations.

![[Pasted image 20260213225040.png]]

Of which only $15$ can tile the plane (if we only use regular polygons). Those who can't are:
- $3.7.42$
- $3.8.24$
- $3.9.18$
- $3.10.15$
- $4.5.20$
- $5.5.10$

Most of the vertex configurations contain at least an irregular equilateral convex polygon, and since there are many orientations for them to be placed around the vertex, the combinations explode pretty quickly. It's not in the scope of the thesis to enumerate all tilings that include this category, but I wanted to try just to see if the algorithm for generating the vertex configuration was robust and generalized enough to handle them.

![[Pasted image 20260225125122.png]]


## 3. Generate the vc compatibility graph

### Max number of vc sets

According to the $k$-transitivity property, and with a naive approach, we can iterate over all sets of $k$ elements out of the $|VC|$ that we have in the set, with replacement.
The total number of "seed sets" consisting of $k$ vertex configuration are:

$$s=\begin{cases}
|VC|&k=1\\\dbinom{|VC|+k-1}k-v&k\gt1
\end{cases}$$

The reason why we subtract $v$ from the total number of possible sets of $k$ elements out of $|VC|$ with replacement, is that those cases where we pick one vc with multiplicity $k$, because if it can construct a tiling, it will be $1$-uniform, so they can be discarded.

### Compatibility checks

Before proceeding with the seed generation, though, we can notice that any two adjacent nodes in a seed must be "compatible" vcs, i.e. two vcs that share a sequence of two polygons. 
For example, $3.4.3.12$ and $3^3.4^2$ are compatible because they both share the $3.4$ subsequence around the vertex, and those are the polygons that they share when attached one to the other.
Following this logic, we can then build a graph of all our vcs and add the edge $(u,v)$ if the vc $u$ is compatible with the vc $v$, like so:

![[WhatsApp Image 2026-02-13 at 23.59.48.jpeg]]

From here, we can already tell that the vc $4^4$ and the vc $3^2.4.12$ will never lead to a valid $2$-uniform tiling, but they could lead to a valid $3$-uniform tiling if we add the vc $3.4^2.6$, because that's compatible with both.
In general, any $n$ distinct vcs can potentially generate a valid $k$-uniform tiling, with $k\ge n$, iff they form a connected subgraph (it can be shown with some examples that it doesn't need to be fully connected).

![[Pasted image 20260225125229.png]]

### Considerations

I'm sure that there is also a way, from this graph alone, to calculate how many seed sets (that can potentially generate a valid tiling) there are for any given value of $k$. 
My first idea for a starting point was to compute the adjacency matrix of this graph and then calculate the following:

$$\dfrac12\sum_i\sum_jA^{k-1}_{ij}$$

In fact, given a matrix $A$, the element $(i,j)$ of the matrix $A^n$ contains the number of possible paths of length $n$ from the node $i$ to the node $j$, so if we sum over the whole matrix $A^{k-1}$ we would get double (all paths and their backward version) the number of possible walks on this graphs, and each walk corresponds to a potential seed set. We would need to consider permutations as the same seed set, but this idea is still raw and I have to spend some more time looking into this.
Another consideration we can make is that even if we add "strange" irregular star polygons, the following search on the seed won't explode because we still check for compatibility on the VC graph. We expect those stars to be disconnected components with just a few nodes, so there will be a very limited number of combinations to try.


## 4. Listing all Seed VC Set

Now we can finally choose a value for $k$. My approach for listing all possible seed sets was to run a search on the graph and extract all multisets, i.e., sets with repetitions, with the exception of multisets of cardinality $k$ composed of just one unique vcs with multiplicity $k$. That is because if we only use one vc we can only get a $1$-uniform tiling.
The results are in the table below, where $k$ is the cardinality of the multisets, and $m$ is the number of unique vcs.

| k/m |   $2$ |    $3$ |     $4$ |     $5$ |    $6$ |   total |
| :-: | ----: | -----: | ------: | ------: | -----: | ------: |
| $2$ |  $68$ |    $-$ |     $-$ |     $-$ |    $-$ |    $68$ |
| $3$ | $136$ |  $284$ |     $-$ |     $-$ |    $-$ |   $420$ |
| $4$ | $204$ |  $852$ |  $1031$ |     $-$ |    $-$ |  $2087$ |
| $5$ | $272$ | $1704$ |  $4124$ |  $2883$ |    $-$ |  $8983$ |
| $6$ | $340$ | $2840$ | $10310$ | $14415$ | $6228$ | $34133$ |

All multisets reported here took only 400ms to generate.
For reference, if we include all regular star polygons up to $n=12$, these are the results:

| k/m |    $2$ |      $3$ |       $4$ |     total |
| :-: | -----: | -------: | --------: | --------: |
| $2$ | $2155$ |      $-$ |       $-$ |    $2155$ |
| $3$ | $4310$ |  $57329$ |       $-$ |   $61639$ |
| $4$ | $6465$ | $171987$ | $1580159$ | $1758611$ |

This run took 17.68 seconds.

From this we can estimate we can currently extract approximately $100$k multisets per second, and that $k=5$ will find approximately $50$ million multisets in $500$ seconds ($\approx 8$ minutes), if we don't run out of memory first.


## 5. Build the Seed

The seed is built incrementally as a graph, where each central vertex in our vcs is a node and we link two nodes when there's an edge that connects them.
Again, we can use a BFS search on the vcs in our set and on the "anchors" of the current seed partial configuration, i.e, all vertices adjacent to the center vertices of the vcs already placed.

![[WhatsApp Image 2026-02-13 at 23.59.48 (2).jpeg]]

Each leaf in the DFS tree that we generated using our choice of the $k$ vcs corresponds to a complete seed shape. Most of them will be rotational and axial symmetries of each other, though, so we will implement some checks to prune the DFS tree and reduce space and time complexity of the search.
The root could, in theory, just be the empty plane, with the second layer of the tree representing the choice for the first VC to place, but the leaves of the $|VC|$ subtrees would all be duplicate of each other, so we can already prune the search by a factor of $|VC|$ simply by starting with a vc at the root.

![[IMG_0401.PNG]]

Additionally, one can see from the example above that when a vc has symmetries, all subtrees will, again, lead to the same configurations. So we can further prune the search to only explore the unique nodes under transitivity.
This can be done at each level, to keep pruning the search and minimize the number of explored nodes.

![[IMG_0402.PNG]]


## 6. Apply the wallpaper groups

For each unique seed (leaves of the tree), we iterate through the $17$ wallpaper groups. For each of them, we apply all the transformations in sequence to fill the plane, and hopefully we should have a valid tiling.
This, in my opinion, is the most difficult step to implement algorithmically, because it should take as input a seed configuration and "encapsulate" it into the fundamental domain of each wallpaper group (and possibly understand the case where it can't).

The first consideration to make is that, since wallpaper groups rely on symmetries, we need to map the shape of the fundamental domain onto the seed configuration so that the vertices of the former align with the construction points (centroids, edge halfways and vertices) of the latter, i.e., the vertices of the fundamental domain should lie of the construction points of the seed's polygons. (there is an exception with this property, and I will go over it later with an example).

This simplifies a lot the problem, moving the search domain from the continuous space to just a finite number of construction points.

For each wallpaper group, its fundamental domain has a specific shape and symmetries, and we can use this information to find a set of construction points such that they satisfy those geometric constraints.
The fundamental domain is always a triangle or a quadrilateral, so a naive approach would be to iterate over the $3$-tuples and $4$-tuples of construction points and check them one by one. That is, for each checking if:
- all angles determined by the selected construction points match those of the selected fundamental domain exactly
- the selected construction points all match the rotational symmetries of the selected fundamental domain optimistically*
- the axis determined by the segments connecting the selected construction points all match the axial symmetries (reflection and glide reflection) of the selected fundamental domain optimistically*

Here, optimistically means that if we check the seed against a reflection, we only check if the existing polygons overlap exactly with each other, assuming that in the empty space we will also match exactly the polygons that will end up there.
This puts a polynomial bound of $O(N^3)$ and $O(N^4)$ on the search for each wallpaper group. 
There are other checks that are necessary to build valid tilings (I still need to check the second and third claim).
The convex hull of the selected set of construction points should:
- contain the convex hull of all vertex configuration central vertex
- contain at least one centroid for each vertex configuration in the seed
- be enclosed in the space occupied by the seed

I haven't proven these yet, there may be exception or edge cases where they don't hold. Regardless, the specific order of these checks would affects the speed of the search, and the goal in this step is to ensure a fail-fast approach, as some of them could be computationally heavy.


## 7. Checks and filtering

Finally, after generating the tiling, all that's left is to check if it's valid (no gaps or overlaps) and if its $k$-uniformity really matches the value for $k$ that we chose at the beginning. 
The first can be done with an angular sum check on each vertex: if the sum of all internal angles surrounding a vertex adds up to $\lt2\pi$, then we have gaps, if it's $\gt2\pi$, we have overlaps.
The $k$-transitivity can be checked by mapping the vertices onto each other and checking how many are unique under the transformations.